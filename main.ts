import { App, Modal, Plugin, PluginSettingTab, Setting, TextComponent } from 'obsidian';

interface RecentFilesSettings {
	historyLength: number;
	files: string[]
}

const DEFAULT_SETTINGS: RecentFilesSettings = {
	historyLength: 15,
	files: []
}

export default class RecentFilesPlugin extends Plugin {
	settings: RecentFilesSettings

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: 'open-recent-files-modal-simple',
			name: 'Open recent files modal',
			callback: () => {
				new RecentFilesModal(this.app, this.settings, this.saveFiles.bind(this)).open();
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SettingTab(this.app, this));
	}

	onunload() {

	}
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async saveFiles(files: string[]): Promise<void> {
		await this.saveData({
			...this.settings,
			files: files
		});
	}
}

class RecentFilesModal extends Modal {
	historyLength = DEFAULT_SETTINGS.historyLength;
	selectedIndex = 0;
	allRecentFiles: string[] = [];
	saveFiles: (files: string[]) => Promise<void>;
	searchText: string = '';

	constructor(app: App, settings: RecentFilesSettings, saveData: (files: string[]) => Promise<void>) {
		super(app);
		this.historyLength = settings.historyLength
		this.saveFiles = saveData;
		const files = this.app.workspace.getLastOpenFiles();
		if (settings.files && settings.files.length > 0) {
			let difference = settings.files.filter((x: string) => !files.includes(x));
			this.allRecentFiles = files.concat(difference).slice(0, this.historyLength);
		} else {
			this.allRecentFiles = files;
		}
	}

	onOpen() {
		const filesToShow = this.allRecentFiles;
		this._draw(filesToShow);
	}

	onClose() {
		const {contentEl} = this;
		this.storeFiles();
		contentEl.empty();
	}

	_draw(filesToShow: string[]) {
		const { contentEl } = this;
		const rootEl = createDiv({ cls: 'nav-folder mod-root, recent-files-root' });
		rootEl.setText('Recent Files');
		const childrenEl = rootEl.createDiv({ cls: 'nav-folder-children' });
		const searchBox = this._createSearchBox(childrenEl, filesToShow);

		const endOfFilesIndex = filesToShow.length - 1;

		filesToShow.forEach((currentFile: any, index: number) => {
			const navFile = childrenEl.createDiv({ cls: 'nav-file recent-files-file' });
			const navFileTitle = navFile.createDiv({ cls: 'nav-file-title recent-files-title' });
			const navFileTitleContent = navFileTitle.createDiv({ cls: 'nav-file-title-content recent-files-title-content' });

			// remove extension for display text
			const fileDisplayName = currentFile.replace(/\.[^/.]+$/, '');
			navFileTitleContent.setText(fileDisplayName);

			navFileTitleContent.addEventListener('click', (event: MouseEvent) => {
				this._openFile(currentFile);
			});
			// Add css to first item in list on render
			if (index === 0) {
				navFile.addClass('recent-files-selected');
			}
		  });

		  childrenEl.addEventListener('keydown', (event: MouseEvent) => {
			  const children = childrenEl.getElementsByClassName('recent-files-file');
			  if (children) {
				  const previousIndex = this.selectedIndex;
				  if (event.key === "ArrowDown" && this.selectedIndex < endOfFilesIndex) {
					  //down
					  this.selectedIndex++;
				  } else if (event.key === "ArrowUp" && this.selectedIndex != 0) {
					  //up
					  this.selectedIndex--;
				  }
				  if (previousIndex != this.selectedIndex) {
					children[previousIndex].removeClass('recent-files-selected');
					children[this.selectedIndex].addClass('recent-files-selected');
				  }
			  }
			  if (event.key === "Enter") {
				  //enter
				  if (this.selectedIndex >= 0 && this.selectedIndex <= endOfFilesIndex) {
					  this._openFile(filesToShow[this.selectedIndex])
				  }
			  }
		  });
		  contentEl.empty();
		  contentEl.appendChild(rootEl);
		  if (searchBox.inputEl) {
			searchBox.inputEl.focus();
		  }
	}

	_createSearchBox(childrenEl: HTMLElement, filesToShow: string[]): TextComponent {
		const input = new TextComponent(childrenEl)
			.setPlaceholder("Search")
			.setValue(this.searchText)
			.onChange((text) => this._handleSearch(text, filesToShow));
		if (input.inputEl) {
			input.inputEl.addClass('recent-files-search-box');
		}
		return input;
	}

	_handleSearch(text: string, filesToShow: string[]): void {
		this.searchText = text;
		let newList = this.allRecentFiles;
		if (text.length >= 1) {
			newList = filesToShow.filter(f => f.toLocaleUpperCase().indexOf(text.toLocaleUpperCase()) > -1);
		}
		this.selectedIndex = 0;
		this._draw(newList);
	}


	_openFile(currentFile: String): void {
		const targetFile = this.app.vault.getFiles().find((f) => f.path === currentFile);

		if (targetFile) {
			let leaf = this.app.workspace.getMostRecentLeaf();

			if (!leaf) {
				leaf = this.app.workspace.getLeaf('tab');
			}
			leaf.openFile(targetFile);
			this.close();
		}
	}

	async storeFiles(): Promise<void> {
		await this.saveFiles(this.allRecentFiles);
	}
}

class SettingTab extends PluginSettingTab {
	plugin: RecentFilesPlugin;

	constructor(app: App, plugin: RecentFilesPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Settings for recent files list'});

		new Setting(containerEl)
			.setName('History Size')
			.setDesc('Number of files to show in the list')
			.addText(text => text
				.setPlaceholder(DEFAULT_SETTINGS.historyLength.toString())
				.setValue(this.plugin.settings.historyLength.toString())
				.onChange(async (value) => {
					this.plugin.settings.historyLength = Number(value);
					await this.plugin.saveSettings();
				}));
	}
}
