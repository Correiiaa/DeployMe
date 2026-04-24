# Diretrizes do Projeto DeployMe

## Arquitetura

- Este é um projeto Electron + React + Tailwind CSS.
- Priorizar o uso de módulos nativos do Node.js (`fs`, `path`) no processo Main.
- Toda a comunicação entre Main e Renderer deve usar `ipcMain` e `ipcRenderer` através do `preload.js`.

## Estilo de Código

- Usar Functional Components e Hooks em React.
- Utilizar Tailwind CSS para todo o styling (evitar CSS puro ou Styled Components).
- O design deve ser "Clean" e "Minimalista", seguindo a paleta de cores Slate/Gray do Tailwind.

## Persistência de Dados

- A fonte da verdade é um ficheiro JSON.
- Sempre que houver uma alteração no estado da tabela, o ficheiro deve ser atualizado (debounce de 2 segundos).
- Erros de rede na sincronização cloud não devem bloquear a UI; usar notificações silenciosas.
