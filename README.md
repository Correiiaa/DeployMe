# deployme

An Electron application with React and TypeScript

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ npm install
```

### Development

```bash
$ export GOOGLE_CLIENT_ID=your_google_client_id
$ export GOOGLE_CLIENT_SECRET=your_google_client_secret
$ export GOOGLE_REDIRECT_URI=http://127.0.0.1:42813/oauth2callback
$ npm run dev
```

When authenticated with Google, DeployMe stores access/refresh tokens with `electron-store` and syncs `vagas.json` with `deployme_data.json` on Google Drive.

### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```
