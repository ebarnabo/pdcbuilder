# PDC Builder

Atelier de projets web pour macOS et Windows. Créer, dupliquer, lancer, construire — et brancher un modèle d'IA local ou distant sur l'ensemble.

## Démarrer

```bash
npm install
npm run dev
```

## Packager

```bash
npm run pack:mac   # .dmg + .zip
npm run pack:win   # installeur .exe + portable
npm run pack:all   # les deux
```

Les binaires sortent dans `release/`.

## Ce que fait l'app

**Projets** — création à partir d'un framework du catalogue, avec les librairies cochées installées dans la foulée. Serveur de dev lancé depuis la carte, URL détectée automatiquement dans la sortie et cliquable. Build de production, bouton pour ouvrir le dossier de sortie et un autre pour ouvrir l'`index.html` généré. Duplication sans `node_modules` puis réinstallation propre. Suppression au choix : retirer de la liste ou envoyer les fichiers à la corbeille.

**Catalogue** — 9 frameworks et une centaine de librairies classées par usage, chacune décrite. Tout est modifiable : ajouter un framework revient à décrire sa commande de création (`{{name}}` est remplacé par le nom du dossier), son serveur de dev, son build et son dossier de sortie.

**Blueprints** — une base = un framework, ses librairies, des fichiers de départ et des commandes post-installation. Un projet existant devient un blueprint en un clic depuis son menu.

**Assistant** — Ollama, LM Studio, Claude, Grok, OpenAI, OpenRouter ou tout endpoint compatible OpenAI. Réponses en streaming. Un bloc de code annoté `path=` obtient un bouton qui l'écrit dans le projet actif ; un bloc `pdc-framework` ou `pdc-library` obtient un bouton qui l'ajoute au catalogue. C'est par là que l'app s'étend toute seule.

## Raccourcis

| | |
|---|---|
| `⌘K` / `Ctrl+K` | Assistant |
| `⌘J` / `Ctrl+J` | Console |
| `↵` / `⇧↵` | Envoyer / nouvelle ligne |
| `⌘1`…`⌘4` | Changer de vue |

## Configuration

Tout est stocké dans un seul fichier JSON :
- macOS `~/Library/Application Support/pdc-builder/pdc-builder.json`
- Windows `%APPDATA%\pdc-builder\pdc-builder.json`

## Structure

```
src/main/      index.js (IPC), store.js (catalogues), runner.js (processus), ai.js (fournisseurs)
src/preload/   pont contextBridge
src/renderer/  App, Projects, Catalog, Blueprints, Chat, Settings, ui, styles
```

Isolation de contexte activée, pas de `nodeIntegration`, CSP stricte. Les commandes shell ne partent que du main.

## Design

Quatre plans de profondeur (fenêtre, canevas, carte, contrôle), chacun avec un filet clair en haut et une ombre portée courte — le relief vient du trait, pas du flou. Une couche de grain à 3 % réchauffe les aplats.

Le mouvement répond aux actions plutôt qu'il ne décore : l'indicateur du rail glisse, le pouce du contrôle segmenté suit l'onglet, le changement de vue passe par l'API View Transitions, la console se redimensionne à la souris. Une seule emphase visuelle : la carte d'un projet dont le serveur tourne respire une lueur ambre. `prefers-reduced-motion` coupe tout.

Type Inter avec chiffres tabulaires sur les compteurs, JetBrains Mono pour les chemins et les logs. Rail réduit aux icônes sous 1120 px.
