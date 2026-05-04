# Contributing

Contribuições são bem-vindas. Antes de abrir um PR, lê isto.

## O que é bem-vindo

- Correcção de bugs com caso de teste reproduzível
- Melhorias de performance no canvas ou nos algoritmos de processamento de imagem
- Suporte a novos formatos de exportação
- Melhorias de acessibilidade e usabilidade
- Traduções da interface

## O que não é bem-vindo (sem discussão prévia)

- Introduzir frameworks (React, Vue, etc.) ou bundlers
- Adicionar dependências de runtime além das já existentes (JSZip, FileSaver.js)
- Refactorizações que não resolvem um problema concreto

A decisão de manter zero dependências de runtime é intencional e não está em discussão.

## Como contribuir

1. Faz fork do repositório
2. Cria um branch descritivo: `fix/export-yolo-classes` ou `feat/keyboard-shortcuts`
3. Faz as alterações — um problema por PR
4. Testa no browser (Chrome, Firefox, Safari)
5. Abre o PR com descrição do problema que resolve e como testaste

## Ambiente de desenvolvimento

```bash
git clone https://github.com/mirosaide/matilho.git
cd matilho
python -m http.server 8080
# Abre http://localhost:8080
```

Sem build step. Edita os ficheiros, recarrega o browser.

## Estrutura dos módulos

| Ficheiro | Responsabilidade |
|---|---|
| `state.js` | Estado global da aplicação |
| `canvas.js` | Renderização e loop de animação |
| `interaction.js` | Eventos de rato e teclado no canvas |
| `images.js` | Carregamento e gestão de imagens |
| `classes.js` | Gestão de classes e cores |
| `export.js` | Exportação YOLO / COCO / VOC |
| `augmentation.js` | Geração de augmentações do dataset |
| `qualitycheck.js` | Detecção de imagens desfocadas |
| `history.js` | Undo/redo |
| `storage.js` | Persistência via localStorage |
| `db.js` | Persistência de imagens via IndexedDB |
| `ui.js` | Actualizações da interface |
| `project.js` | Import/export do projecto completo |
| `refresh.js` | Ciclo de actualização do estado |

## Reportar bugs

Usa o [template de bug report](.github/ISSUE_TEMPLATE/bug_report.md). Sem passos de reprodução, o issue será fechado.
