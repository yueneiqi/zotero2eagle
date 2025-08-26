# File Logging Feature

The Zotero2Eagle plugin now includes comprehensive file logging functionality to help troubleshoot issues and track image annotation saves.

## How it works

When the plugin is active and an **Output Directory** is configured in preferences:

1. **Log directory creation**: A `logs/` subdirectory is automatically created in your configured Output Directory
2. **Daily log files**: Log entries are written to `zotero2eagle_YYYY-MM-DD.log` files
3. **Dual logging**: Messages are logged both to Zotero's debug console AND to the local file
4. **Automatic rotation**: Log files are rotated when they exceed 10MB

## Log file location

If your Output Directory is set to `/Users/yourname/Documents/Zotero2Eagle/`, then logs will be stored in:
```
/Users/yourname/Documents/Zotero2Eagle/logs/zotero2eagle_2025-08-26.log
```

## What gets logged

### Plugin Events
- Plugin startup and shutdown
- Configuration loading
- PDF button initialization

### Image Annotation Processing  
- When image annotations are detected
- Image extraction attempts and results
- File save operations (success/failure)
- Error conditions and debugging info

### Log Levels
- **INFO**: Normal operations (green in progress window)
- **WARN**: Warnings like missing configuration (yellow)  
- **ERROR**: Failures and exceptions (red)
- **DEBUG**: Detailed debugging information

## Example log entries

```
[2025-08-26T15:30:23.456Z] [INFO] [Startup] Zotero2Eagle plugin starting up
[2025-08-26T15:30:24.789Z] [INFO] [ImageSaver] Starting image save for annotation ABC123
[2025-08-26T15:30:24.890Z] [INFO] [ImageSaver] Output directory configured: /Users/name/Documents/Zotero2Eagle
[2025-08-26T15:30:25.123Z] [INFO] [ImageSaver] Extracted image data, size: 45678 characters  
[2025-08-26T15:30:25.234Z] [INFO] [ImageSaver] Image saved successfully to: /Users/name/Documents/Zotero2Eagle/Document_Title_ABC123_p5_2025-08-26T15-30-25-234Z.png
[2025-08-26T15:30:25.235Z] [INFO] [ImageSaver] [SUCCESS] Saved annotation ABC123 as Document_Title_ABC123_p5_2025-08-26T15-30-25-234Z.png
```

## Disabling file logging

File logging is automatically disabled if:
- No Output Directory is configured in plugin preferences
- The Output Directory path is invalid or inaccessible
- File system errors occur (fallback to console-only logging)

## Privacy note

Log files may contain:
- Document titles and metadata
- File paths on your system  
- Error messages with system information
- Annotation IDs (not the actual annotation content)

Log files are stored locally and never transmitted anywhere.