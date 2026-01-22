const STORAGE_KEY = "budgetAppStateV2";

let appState = {};
let currentMonthKey = null;
let appInitialized = false;
let googleChartsLoaded = false;
let defaultTablesConfig = null;

// Load Google Charts Sankey
if (window.google && window.google.charts) {
	google.charts.load("current", { packages: ["sankey"] });
	google.charts.setOnLoadCallback(() => {
		googleChartsLoaded = true;
		if (appInitialized && currentMonthKey) {
			drawSankey(getCurrentMonthState());
		}
	});
}

function sanitizeAmount(value) {
	const n = Number(value);
	if (!Number.isFinite(n) || n <= 0) return 0;
	return n;
}

function formatCurrency(value) {
	const n = Number(value) || 0;
	return `${n.toLocaleString("fr-FR", {
		maximumFractionDigits: 0,
	})} €`;
}

function getMonthKeyFromInputValue(v) {
	if (!v) return null;
	// Expecting YYYY-MM from <input type="month">
	return v;
}

function getCurrentMonthState() {
	if (!currentMonthKey) return null;
	if (!appState[currentMonthKey]) {
		appState[currentMonthKey] = createEmptyMonthState();
	}
	return appState[currentMonthKey];
}

function createEmptyMonthState() {
	const cfg = defaultTablesConfig || { essentiels: [], envies: [], epargne: [] };
	return {
		salary: 0,
		essentiels: (cfg.essentiels || []).map((item) => ({
			label: item.label,
			amount: item.defaultAmount ?? 0,
		})),
		envies: (cfg.envies || []).map((item) => ({
			label: item.label,
			amount: item.defaultAmount ?? 0,
		})),
		epargne: (cfg.epargne || []).map((item) => ({
			label: item.label,
			amount: item.defaultAmount ?? 0,
		})),
	};
}

function resetCurrentMonthTablesToDefaults() {
	if (!currentMonthKey) {
		window.alert("Aucun mois en cours à réinitialiser.");
		return;
	}
	const state = getCurrentMonthState();
	if (!state) {
		window.alert("État du mois introuvable.");
		return;
	}
	const cfg = defaultTablesConfig || { essentiels: [], envies: [], epargne: [] };
	state.essentiels = (cfg.essentiels || []).map((item) => ({
		label: item.label,
		amount: item.defaultAmount ?? 0,
	}));
	state.envies = (cfg.envies || []).map((item) => ({
		label: item.label,
		amount: item.defaultAmount ?? 0,
	}));
	state.epargne = (cfg.epargne || []).map((item) => ({
		label: item.label,
		amount: item.defaultAmount ?? 0,
	}));
	saveAppState();
	renderAll();
}

function loadAppState() {
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) {
			appState = {};
			return;
		}
		const parsed = JSON.parse(raw);
		appState = migrateState(parsed || {});
	} catch (e) {
		console.error("Erreur chargement état :", e);
		appState = {};
	}
}

function migrateState(oldState) {
	const migrated = {};
	for (const [month, state] of Object.entries(oldState || {})) {
		const monthState = createEmptyMonthState();

		const src = state || {};

		monthState.salary = Number(src.salary) || 0;

		// Try to migrate from old structure
		if (Array.isArray(src.essentiels)) {
			monthState.essentiels = src.essentiels.map((item) => ({
				label: (item && item.label) || "",
				amount: Number(item && item.amount) || 0,
			}));
		}
		if (Array.isArray(src.envies)) {
			monthState.envies = src.envies.map((item) => ({
				label: (item && item.label) || "",
				amount: Number(item && item.amount) || 0,
			}));
		}
		if (Array.isArray(src.epargne)) {
			monthState.epargne = src.epargne.map((item) => ({
				label: (item && item.label) || "",
				amount: Number(item && item.amount) || 0,
			}));
		}

		migrated[month] = monthState;
	}
	return migrated;
}

function saveAppState() {
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
	} catch (e) {
		console.error("Erreur sauvegarde état :", e);
	}
}

async function loadDefaultTablesConfig() {
	if (defaultTablesConfig) return defaultTablesConfig;
	try {
		const res = await fetch("default-tables.json", { cache: "no-cache" });
		if (!res.ok) {
			throw new Error(`HTTP ${res.status}`);
		}
		const data = await res.json();
		defaultTablesConfig = data || { essentiels: [], envies: [], epargne: [] };
	} catch (e) {
		console.error("Erreur de chargement de default-tables.json :", e);
		defaultTablesConfig = { essentiels: [], envies: [], epargne: [] };
	}
	return defaultTablesConfig;
}

function initMonthSelector() {
	const monthInput = document.getElementById("monthSelector");
	const today = new Date();
	const current = `${today.getFullYear()}-${String(
		today.getMonth() + 1
	).padStart(2, "0")}`;

	monthInput.value = current;
	currentMonthKey = getMonthKeyFromInputValue(monthInput.value);

	monthInput.addEventListener("change", () => {
		const newKey = getMonthKeyFromInputValue(monthInput.value);
		currentMonthKey = newKey;
		renderAll();
	});
}

function duplicatePreviousMonth() {
 	if (!currentMonthKey) return;
	const [yearStr, monthStr] = currentMonthKey.split("-");
	const year = Number(yearStr);
	const month = Number(monthStr); // 1-12
	let prevYear = year;
	let prevMonth = month - 1;
	if (prevMonth === 0) {
		prevMonth = 12;
		prevYear -= 1;
	}
	const prevKey = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
	const prevState = appState[prevKey];
	if (!prevState) {
		return;
	}
	const clone = JSON.parse(JSON.stringify(prevState));
	clone.salary = 0; // do not carry over last month salary
	appState[currentMonthKey] = clone;
	saveAppState();
	renderAll();
}

function setupEventListeners() {
	document
		.getElementById("duplicateMonthBtn")
		.addEventListener("click", duplicatePreviousMonth);

	const salaryInput = document.getElementById("salaryInput");

	salaryInput.addEventListener("input", () => {
		const state = getCurrentMonthState();
		state.salary = Number(salaryInput.value) || 0;
		saveAppState();
		renderSummaryAndSankey();
	});

	const resetBtn = document.getElementById("resetTablesBtn");
	if (resetBtn) {
		resetBtn.addEventListener("click", () => {
			const ok = window.confirm(
				"Réinitialiser les montants de ce mois avec les valeurs par défaut ? Cela remplacera les montants actuels des 3 tableaux."
			);
			if (!ok) return;
			resetCurrentMonthTablesToDefaults();
		});
	}

	setupTableListeners("essentielsBody", "essentiels");
	setupTableListeners("enviesBody", "envies");
	setupTableListeners("epargneBody", "epargne");

	window.addEventListener("resize", () => {
		if (googleChartsLoaded && appInitialized && currentMonthKey) {
			drawSankey(getCurrentMonthState());
		}
	});
}

function setupTableListeners(tbodyId, stateKey) {
	const tbody = document.getElementById(tbodyId);
	if (!tbody) return;
	tbody.addEventListener("input", (event) => {
		const row = event.target.closest("tr");
		if (!row) return;
		const index = Number(row.dataset.index);
		const state = getCurrentMonthState();
		const list = state[stateKey];
		const item = list[index];
		if (!item) return;

		if (event.target.classList.contains("row-amount")) {
			item.amount = Number(event.target.value) || 0;
		}
		saveAppState();
		renderSummaryAndSankey();
	});
}

function renderAll() {
	const state = getCurrentMonthState();
	if (!state) return;

	const salaryInput = document.getElementById("salaryInput");
	salaryInput.value = state.salary || 0;

	renderTable("essentielsBody", state.essentiels);
	renderTable("enviesBody", state.envies);
	renderTable("epargneBody", state.epargne);

	renderSummaryAndSankey();
}

function renderTable(tbodyId, items) {
	const tbody = document.getElementById(tbodyId);
	if (!tbody) return;
	tbody.innerHTML = "";
	items.forEach((item, index) => {
		const tr = document.createElement("tr");
		tr.dataset.index = String(index);

		const labelTd = document.createElement("td");
		labelTd.textContent = item.label || "";

		const amountTd = document.createElement("td");
		const amountInput = document.createElement("input");
		amountInput.type = "number";
		amountInput.min = "0";
		amountInput.step = "10";
		amountInput.value = item.amount || 0;
		amountInput.className = "row-amount";
		amountTd.appendChild(amountInput);

		const actionsTd = document.createElement("td");
		tr.appendChild(labelTd);
		tr.appendChild(amountTd);
		tr.appendChild(actionsTd);
		tbody.appendChild(tr);
	});
}

function computeTotals(state) {
	const salary = Number(state.salary) || 0;
	
	const totalEssentiels = (state.essentiels || []).reduce(
		(sum, item) => sum + (Number(item.amount) || 0),
		0
	);
	const totalEnvies = (state.envies || []).reduce(
		(sum, item) => sum + (Number(item.amount) || 0),
		0
	);
	const totalEpargne = (state.epargne || []).reduce(
		(sum, item) => sum + (Number(item.amount) || 0),
		0
	);
	
	const totalDepenses = totalEssentiels + totalEnvies;
	const pouvoirAchat = salary - totalDepenses;
	
	return {
		salary,
		totalEssentiels,
		totalEnvies,
		totalEpargne,
		totalDepenses,
		pouvoirAchat,
		percentageEssentiels: salary > 0 ? (totalEssentiels / salary * 100) : 0,
		percentageEnvies: salary > 0 ? (totalEnvies / salary * 100) : 0,
		percentageEpargne: salary > 0 ? (totalEpargne / salary * 100) : 0,
	};
}

function renderSummaryAndSankey() {
	const state = getCurrentMonthState();
	if (!state) return;
	const totals = computeTotals(state);

	// Find specific amounts
	const loyerItem = (state.essentiels || []).find(item => item.label === "Loyer");
	const loyerAmount = loyerItem ? Number(loyerItem.amount) || 0 : 0;
	
	const coursesItem = (state.essentiels || []).find(item => item.label === "Courses alimentaires");
	const coursesAmount = coursesItem ? Number(coursesItem.amount) || 0 : 0;
	
	const revolutPerso = totals.pouvoirAchat + coursesAmount;

	document.getElementById("summarySalary").textContent = formatCurrency(
		totals.salary
	);
	document.getElementById("summaryRevolutPerso").textContent = formatCurrency(
		revolutPerso
	);
	document.getElementById("summaryCompteJoint").textContent = formatCurrency(
		loyerAmount
	);
	document.getElementById("summaryEpargne").textContent = formatCurrency(
		totals.totalEpargne
	);
	document.getElementById("summaryPouvoir").textContent = formatCurrency(
		totals.pouvoirAchat
	);

	// Update table footers
	document.getElementById("totalEssentiels").textContent = formatCurrency(
		totals.totalEssentiels
	);
	document.getElementById("totalEnvies").textContent = formatCurrency(
		totals.totalEnvies
	);
	document.getElementById("totalEpargne").textContent = formatCurrency(
		totals.totalEpargne
	);
	
	document.getElementById("percentageEssentiels").textContent = 
		totals.percentageEssentiels.toFixed(0) + "%";
	document.getElementById("percentageEnvies").textContent = 
		totals.percentageEnvies.toFixed(0) + "%";
	document.getElementById("percentageEpargne").textContent = 
		totals.percentageEpargne.toFixed(0) + "%";

	// Update differences with target percentages
	const salary = totals.salary;
	
	// Besoins essentiels: 60%
	const targetEssentiels = salary * 0.60;
	const diffEssentiels = totals.totalEssentiels - targetEssentiels;
	updateDifference("differenceEssentiels", diffEssentiels);
	
	// Envies: 25%
	const targetEnvies = salary * 0.25;
	const diffEnvies = totals.totalEnvies - targetEnvies;
	updateDifference("differenceEnvies", diffEnvies);
	
	// Épargne: 15%
	const targetEpargne = salary * 0.15;
	const diffEpargne = totals.totalEpargne - targetEpargne;
	updateDifference("differenceEpargne", diffEpargne);

	if (googleChartsLoaded) {
		drawSankey(state);
	}
}

function updateDifference(elementId, difference) {
	const element = document.getElementById(elementId);
	if (!element) return;
	
	const absDiff = Math.abs(difference);
	if (difference > 0) {
		element.textContent = `Différence : +${formatCurrency(absDiff)}`;
		element.style.color = "#dc2626"; // Rouge pour dépassement
	} else if (difference < 0) {
		element.textContent = `Différence : -${formatCurrency(absDiff)}`;
		element.style.color = "#16a34a"; // Vert pour économie
	} else {
		element.textContent = "Différence : 0 €";
		element.style.color = "#6b7280"; // Gris neutre
	}
}

function drawSankey(state) {
	const sankeyDiv = document.getElementById("sankeyChart");
	const emptyP = document.getElementById("sankeyEmpty");
	if (!sankeyDiv) return;

	const totals = computeTotals(state);
	const salary = sanitizeAmount(totals.salary);

	const NODE_SALAIRE = "Salaire";

	const links = [];

	if (salary > 0) {
		// Directly link all individual items from salary
		(state.essentiels || []).forEach((item) => {
			const amount = sanitizeAmount(item.amount);
			if (amount > 0 && item.label) {
				links.push([NODE_SALAIRE, item.label, amount]);
			}
		});

		(state.envies || []).forEach((item) => {
			const amount = sanitizeAmount(item.amount);
			if (amount > 0 && item.label) {
				links.push([NODE_SALAIRE, item.label, amount]);
			}
		});

		(state.epargne || []).forEach((item) => {
			const amount = sanitizeAmount(item.amount);
			if (amount > 0 && item.label) {
				links.push([NODE_SALAIRE, item.label, amount]);
			}
		});
	}

	// Safety: never allow a self-link that would create a cycle
	const safeLinks = links.filter(
		([from, to]) => typeof from === "string" && from !== to
	);

	if (salary <= 0 || safeLinks.length === 0) {
		sankeyDiv.innerHTML = "";
		emptyP.classList.remove("hidden");
		return;
	}

	emptyP.classList.add("hidden");

	const dataArray = [["De", "Vers", "Montant"], ...safeLinks];
	const data = google.visualization.arrayToDataTable(dataArray);

	const options = {
		sankey: {
			link: {
				colorMode: "gradient",
				colors: ["#4c6fff", "#8b5cff", "#10b981"],
			},
			node: {
				label: {
					fontName: "system-ui",
					fontSize: 12,
				},
			},
		},
	};

	const chart = new google.visualization.Sankey(sankeyDiv);
	chart.draw(data, options);
}

document.addEventListener("DOMContentLoaded", () => {
	initApp();

	// If charts loaded after DOMContentLoaded, they will draw via callback.
});

async function initApp() {
	await loadDefaultTablesConfig();
	loadAppState();
	initMonthSelector();
	setupEventListeners();
	appInitialized = true;
	renderAll();
}

