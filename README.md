# Zotero2Eagle Integration Plugin

[![zotero target version](https://img.shields.io/badge/Zotero-7-green?style=flat-square&logo=zotero&logoColor=CC2936)](https://www.zotero.org)

A Zotero plugin that seamlessly integrates with [Eagle](https://eagle.cool/), allowing you to save PDF image annotations directly to your Eagle library for better visual content management.

[English](README.md) | [简体中文](doc/README-zhCN.md)

## Compatibility

This add-on has only been tested on macOS 13.7.8 so far; other operating systems may require additional validation.

## Disclaimer

This project is made by Vibe Coding and provided as-is; use it at your own risk.

## Features

- **One-click save**: Extract image annotations from PDFs and save them directly to Eagle
- **Smart metadata**: Automatically includes document title, authors, publication year, and page numbers
- **Flexible storage**: Save to both Eagle and local directories simultaneously
- **Batch operations**: Process multiple image annotations efficiently
- **Connection testing**: Built-in Eagle API connectivity testing
- **Comprehensive logging**: Detailed logging for troubleshooting and monitoring

## Installation

1. Download the latest XPI file from [Releases](../../releases)
2. In Zotero, go to `Tools → Add-ons`
3. Click the gear icon → `Install Add-on From File...`
4. Select the downloaded XPI file

## Configuration

### Eagle Integration Setup

1. Open Zotero Preferences → Zotero2Eagle
2. Configure your Eagle API settings:
   - **API URL**: Default `http://localhost:41595` (Eagle's default port)
   - **API Token**: Your Eagle API token (required for authentication)
3. Click "Test Connection" to verify the setup
   - **Known issue**: The `Test Connection` button may fail to show a successful status even when Eagle connectivity is working; try saving an annotation to confirm instead.

### Output Directory (Optional)

Configure a local backup directory for image files:

- Set the **Output Directory** path for local file storage
- Images will be saved with descriptive filenames including document metadata

## Usage

1. Open a PDF in Zotero's PDF reader
2. Create image annotations (highlight and extract image regions)
3. Images are automatically processed and saved to Eagle
4. Optional: Also saved locally if output directory is configured
5. After the Eagle import completes, click the image URL backlink to jump back to the Zotero PDF

## Documentation

- [Logging Documentation](doc/LOGGING.md) - File logging and troubleshooting
- [Development Guidelines](doc/DEVELOPMENT.md) - Development guidelines and project structure

## Development

### Requirements

- [Node.js](https://nodejs.org/) (LTS version)
- [Git](https://git-scm.com/)
- [Zotero Beta](https://www.zotero.org/support/beta_builds)

### Setup

```bash
# Clone the repository
git clone https://github.com/your-username/zotero2eagle.git
cd zotero2eagle

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env
# Edit .env with your Zotero paths

# Start development server
npm start
```

### Build

```bash
# Build for production
npm run build

# Run tests
npm test

# Lint code
npm run lint:check
```

### Release

```bash
# Create new release
npm run release
```

## API Architecture

The plugin is built with a modular architecture:

- **Eagle API Client** (`src/utils/eagleApi.ts`): HTTP client for Eagle API integration
- **Image Saver** (`src/utils/imageSaver.ts`): Image extraction and storage logic
- **File Logger** (`src/utils/fileLogger.ts`): Comprehensive logging system
- **PDF Button** (`src/modules/pdfButton.ts`): PDF reader UI integration
- **Preferences** (`src/modules/preferenceScript.ts`): Settings management

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes following the coding guidelines in [DEVELOPMENT.md](doc/DEVELOPMENT.md)
4. Add tests for new functionality
5. Submit a pull request

## License

This project is licensed under the AGPL License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

Built with the [Zotero Plugin Template](https://github.com/windingwind/zotero-plugin-template) by [@windingwind](https://github.com/windingwind).

[![Using Zotero Plugin Template](https://img.shields.io/badge/Using-Zotero%20Plugin%20Template-blue?style=flat-square&logo=github)](https://github.com/windingwind/zotero-plugin-template)
