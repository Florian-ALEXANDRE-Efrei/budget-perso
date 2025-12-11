# budget-perso

Petit outil web statique pour suivre un budget mensuel :
sélection d'un mois, saisie du salaire, des charges, du détail
du loyer, et visualisation d'un graphique Sankey.

## Lancer l'application en local

Dans le dossier du projet :

```bash
python3 -m http.server 8000
```

Puis ouvrir : <http://localhost:8000/>

## Données et configuration

- Les données sont stockées dans `localStorage` du navigateur, par mois
	(`YYYY-MM`).
- Lorsqu'un mois n'a pas encore de données, les tableaux sont
	initialisés à partir du fichier `default-tables.json` :
	- section `charges` pour le tableau **Charges** ;
	- section `rentDetails` pour le tableau **Détails du loyer**.
- Les libellés des lignes sont **fixes** (non modifiables dans l'UI),
	seuls les montants sont éditables.

## Réinitialiser les montants d'un mois

- Choisir le mois dans le sélecteur.
- Cliquer sur le bouton :
	`Réinitialiser les montants depuis les valeurs par défaut`.
- Confirmer la boîte de dialogue.
- Les montants des tableaux **Charges** et **Détails du loyer** sont
	remis aux valeurs définies dans `default-tables.json` pour ce mois,
	sans modifier le salaire ni le `Loyer facture totale`.