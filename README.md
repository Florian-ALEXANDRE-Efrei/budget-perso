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

## Export / import JSON (par mois)

- **Exporter les données du mois**
	- Choisir le mois en haut de la page.
	- Cliquer sur `Exporter les données du mois`.
	- Un fichier `budget-data.json` est téléchargé.
	- Le fichier peut contenir plusieurs mois ; seul le mois courant est
		ajouté ou mis à jour à chaque export.

- **Importer les données du mois**
	- Choisir le mois cible dans le sélecteur.
	- Cliquer sur `Importer les données du mois` et sélectionner un
		fichier `budget-data.json`.
	- Si le fichier contient des données pour le mois courant, elles
		sont chargées.
	- Sinon, l'appli essaie de charger le **mois précédent** ; en cas de
		succès un message indique que le mois précédent a été utilisé.
	- Si aucune donnée n'est trouvée pour le mois courant ni pour le
		mois précédent, un message d'erreur s'affiche et rien n'est modifié.

L'export utilise un JSON de la forme :

```json
{
	"version": 1,
	"months": {
		"2025-12": { "salary": 0, "rentBillTotal": 0, "charges": [], "rentDetails": [] }
	}
}
```

Chaque entrée de `months` correspond à l'état interne pour un mois
(`appState["YYYY-MM"]`).