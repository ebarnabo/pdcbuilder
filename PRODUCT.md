# Product

## Register

product

## Users

Des développeurs web qui ouvrent PDC Builder comme un atelier de bureau, pas comme un site. Ils créent un projet, choisissent un framework, éventuellement une base et des librairies, lancent le serveur, puis reviennent pour build, Git et l’assistant. Ils sont déjà dans le flux d’un outil (Cursor, VS Code, terminal) : chaque écran doit servir une tâche, pas une visite.

## Product Purpose

PDC Builder échafaude des projets web locaux : catalogue de frameworks et de librairies, blueprints, base de données, dépôt Git, console des commandes, documentation locale pour l’IA, mises à jour de l’app. Le succès, c’est un projet prêt à coder sans friction de scaffolding, et une interface qui disparaît derrière ce geste.

## Brand Personality

Chaleureux, précis, d’atelier. L’app parle français, tutoie, nomme les choses (projet, catalogue, console). Confiance d’outil — pas de marketing, pas de métriques héros.

## Anti-references

- Clones génériques de VS Code / dashboard SaaS crème, navy-and-gold, glassmorphism décoratif
- Barres de défilement custom « pour le style » qui volent le geste natif
- Pages-catalogue infinies où tout est déplié et la molette emporte le fond derrière une modale
- Motion rebondissante, eyebrows en petites capitales, grilles de cartes identiques

## Design Principles

- Une tâche, un pane de scroll. Le fond ne bouge pas sous une modale, un chat ou la console.
- Progressive disclosure : les listes longues se plient ; on n’oblige pas à traverser 400 librairies pour ajouter une ligne.
- L’emphase unique est le projet en vie. Le reste reste secondaire.
- Vocabulaire stable : projet, blueprint, catalogue, atelier, console, assistant.
- Densité d’outil de bureau : familiarité Linear/Raycast, pas surprise de landing.

## Accessibility & Inclusion

WCAG AA sur le texte et les contrastes. `prefers-reduced-motion` coupe animations et scrolls fluides. Cible clavier : focus visible, piège de focus dans les modales, Échap pour fermer. L’app est un client Electron de bureau (pointeur fin) ; les contrôles restent ≥ 32px.
