
# discord-media-server

A self-hosted Discord bot that scans your local media folder for movie files, displays recently added movies and lets you browse/search titles from Discord. Built with Node.js + SQLite/MySQL.

---

## Features

- Scans your movie folder for `.mp4`, `.mkv`, `.avi`
- Fetches metadata from [TMDb](https://www.themoviedb.org/)
- Stores info in SQLite or MySQL
- Search and browse directly from Discord
- Auto-download movie posters (optional)
- Update and re-scan your library anytime
- Easy CLI setup and config

---

## To-Do Future implentation

- Shows and music support

---

## Installation

> Requires [Node.js 18+](https://nodejs.org/) and an existing Discord bot token & TMDb API key.

### 1. Install globally via NPM:

```bash
npm install -g discord-media-server
```

### 2. Run initialization:

```bash
discord-media-server init
```

You’ll be prompted for:
- Media folder path (e.g., `D:\Movies`)
- Database type (SQLite or MySQL)
- Discord bot token
- TMDb API key


## - OR SEPARATELY -


### 2. Setup the server (not needed if started init):

```bash
discord-media-server setup
```

This will:
- Start the setup process
- Get bot tokens, TMDb key, media directory and create database

### 3. Scan the media (not needed if started in init):

```bash
discord-media-server scan
```

This will:
- Scans media and inserts into database
- Creates a cache file with scanned data

### 4. Start the server (not needed if started in init):

```bash
discord-media-server start
```

This will:
- Start the Discord bot
- Launch a local Express server (http://localhost:3000)
- Enable commands in your Discord server

### 5. Reset database:

```bash
discord-media-server reset
```

This will:
- Clears database and deletes cache file

---

## Usage

In Discord:

- `.scan` — Scan media folder and update the database (only used by admin)


Single Movie Command: `.m` or `.movie`
Args (can be in any order):
	year: `-y [year]`
- `.m [searchTitle]` — Search movies by title returns one movie
- `.m [searchTitle] -y [year]` — Search more specific using the year and title


Multiple Movie Command: `.ml` or `.movie-list`
Args (can be in any order):
	year: `-y [year]`
	limit: `-[limit]` or `-l [limit]`
- `.ml [searchTerm]` — Search movies by title returns a list
- `.ml [searchTerm] -y [year] -[limit]` — Search movies by title with year and limit of how many return

---

## Example Commands

```
.scan

.m The Matrix
.m Star Wars -y 1977

.ml The Matrix
.ml Matrix -10

```

---

## Database Info

By default, a local SQLite file will be used (stored in `/data/media.sqlite`). You can choose MySQL during setup.

Movie data is cached in `/data/media.json`.

---

## TMDb + Discord Setup

- Get a free TMDb API key: https://www.themoviedb.org/settings/api
- Create a Discord bot: https://discord.com/developers/applications
- Add bot to your server:  
  ```
  https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&scope=bot&permissions=274877975552
  ```

---

## Manual Commands

You can also run:

```bash
discord-media-server init     # Runs setup, scan and start
discord-media-server setup    # Sets up database and APIs
discord-media-server scan     # Scans media directory and updates the database
discord-media-server start    # Starts server and discord bot
discord-media-server reset    # Clears the database and cache file
```

---

## File Structure

```
bin/          # CLI entry points (setup, start, scan)
lib/          # Core logic (bot, scanner, database)
config.json   # User config
.env          # API keys and tokens
data/         # SQLite DB and cache file
```

---

## Credits

Created by [@Lukedeez](https://github.com/Lukedeez)  
Powered by [discord.js](https://discord.js.org/) and [TMDb API](https://www.themoviedb.org/)

---

## Disclaimer

This is a personal self-hosted project. TMDb API usage is subject to their [terms of service](https://www.themoviedb.org/documentation/api/terms-of-use).
