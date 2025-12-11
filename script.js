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
	const cfg = defaultTablesConfig || { charges: [], rentDetails: [] };
	return {
		salary: 0,
		rentBillTotal: 0,
		charges: (cfg.charges || []).map((item) => ({
			label: item.label,
			amount: item.defaultAmount ?? 0,
		})),
		rentDetails: ensureMandatoryRentRows(
			(cfg.rentDetails || []).map((item) => ({
				label: item.label,
				amount: item.defaultAmount ?? 0,
			}))
		),
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
	const cfg = defaultTablesConfig || { charges: [], rentDetails: [] };
	state.charges = (cfg.charges || []).map((item) => ({
		label: item.label,
		amount: item.defaultAmount ?? 0,
	}));
	state.rentDetails = ensureMandatoryRentRows(
		(cfg.rentDetails || []).map((item) => ({
			label: item.label,
			amount: item.defaultAmount ?? 0,
		}))
	);
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
		monthState.rentBillTotal =
			Number(
				src.rentBillTotal != null ? src.rentBillTotal : src.rent
			) || 0;

		const combinedCharges = [];
		if (Array.isArray(src.charges)) combinedCharges.push(...src.charges);
		if (Array.isArray(src.fixedCharges))
			combinedCharges.push(...src.fixedCharges);
		if (Array.isArray(src.variableCharges))
			combinedCharges.push(...src.variableCharges);

		monthState.charges = combinedCharges.map((item) => ({
			label: (item && item.label) || "",
			amount: Number(item && item.amount) || 0,
		}));

		let rentDetails = Array.isArray(src.rentDetails) ? src.rentDetails : [];
		// Normalize rent details and ensure mandatory rows
		rentDetails = rentDetails.map((item) => ({
			label: (item && item.label) || "",
			amount: Number(item && item.amount) || 0,
		}));
		monthState.rentDetails = ensureMandatoryRentRows(rentDetails);

		migrated[month] = monthState;
	}
	return migrated;
}

function ensureMandatoryRentRows(list) {
	const normalized = Array.isArray(list) ? [...list] : [];
	let loyer = normalized.find((i) => i.label === "Loyer");
	let provision = normalized.find(
		(i) => i.label === "Provision pour charges"
	);
	if (!loyer) {
		loyer = { label: "Loyer", amount: 0 };
	}
	if (!provision) {
		provision = { label: "Provision pour charges", amount: 0 };
	}
	const others = normalized.filter(
		(i) => i.label !== "Loyer" && i.label !== "Provision pour charges"
	);
	return [loyer, provision, ...others];
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
		defaultTablesConfig = data || { charges: [], rentDetails: [] };
	} catch (e) {
		console.error("Erreur de chargement de default-tables.json :", e);
		defaultTablesConfig = { charges: [], rentDetails: [] };
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
	const rentInput = document.getElementById("rentInput");

	salaryInput.addEventListener("input", () => {
		const state = getCurrentMonthState();
		state.salary = Number(salaryInput.value) || 0;
		saveAppState();
		renderSummaryAndSankey();
	});

	rentInput.addEventListener("input", () => {
		const state = getCurrentMonthState();
		state.rentBillTotal = Number(rentInput.value) || 0;
		saveAppState();
		renderSummaryAndSankey();
	});

	const resetBtn = document.getElementById("resetTablesBtn");
	if (resetBtn) {
		resetBtn.addEventListener("click", () => {
			const ok = window.confirm(
				"Réinitialiser les montants de ce mois avec les valeurs par défaut ? Cela remplacera les montants actuels des tableaux Charges et Détails du loyer."
			);
			if (!ok) return;
			resetCurrentMonthTablesToDefaults();
		});
	}

	setupChargesTableListeners();
	setupRentDetailsTableListeners();

	window.addEventListener("resize", () => {
		if (googleChartsLoaded && appInitialized && currentMonthKey) {
			drawSankey(getCurrentMonthState());
		}
	});
}

function setupChargesTableListeners() {
	const tbody = document.getElementById("chargesBody");
	if (!tbody) return;
	tbody.addEventListener("input", (event) => {
		const row = event.target.closest("tr");
		if (!row) return;
		const index = Number(row.dataset.index);
		const state = getCurrentMonthState();
		const list = state.charges;
		const item = list[index];
		if (!item) return;

		if (event.target.classList.contains("row-label")) {
			item.label = event.target.value;
		} else if (event.target.classList.contains("row-amount")) {
			item.amount = Number(event.target.value) || 0;
		}
		saveAppState();
		renderSummaryAndSankey();
	});

}

function setupRentDetailsTableListeners() {
	const tbody = document.getElementById("rentDetailsBody");
	if (!tbody) return;
	tbody.addEventListener("input", (event) => {
		const row = event.target.closest("tr");
		if (!row) return;
		const index = Number(row.dataset.index);
		const state = getCurrentMonthState();
		const list = state.rentDetails;
		const item = list[index];
		if (!item) return;

		if (event.target.classList.contains("row-label")) {
			// Only optional rows have editable labels
			item.label = event.target.value;
		} else if (event.target.classList.contains("row-amount")) {
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
	const rentInput = document.getElementById("rentInput");
	salaryInput.value = state.salary || 0;
	rentInput.value = state.rentBillTotal || 0;

	renderChargesTable("chargesBody", state.charges);
	renderRentDetailsTable("rentDetailsBody", state.rentDetails);

	renderSummaryAndSankey();
}

function renderChargesTable(tbodyId, items) {
	const tbody = document.getElementById(tbodyId);
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

function renderRentDetailsTable(tbodyId, items) {
	const tbody = document.getElementById(tbodyId);
	if (!tbody) return;
	tbody.innerHTML = "";
	const normalized = ensureMandatoryRentRows(items || []);
	const state = getCurrentMonthState();
	state.rentDetails = normalized;
	
	normalized.forEach((item, index) => {
		const isMandatory =
			item.label === "Loyer" || item.label === "Provision pour charges";
		const tr = document.createElement("tr");
		tr.dataset.index = String(index);
		if (isMandatory) tr.dataset.mandatory = "true";

		const labelTd = document.createElement("td");
		labelTd.textContent = item.label;

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
	// Rent = sum of all rent detail rows (Loyer, Provision, and other lines)
	const totalRent = (state.rentDetails || []).reduce(
		(sum, item) => sum + (Number(item.amount) || 0),
		0
	);
	// Charges = sum of all rows in the single "charges" table
	const totalCharges = (state.charges || []).reduce(
		(sum, item) => sum + (Number(item.amount) || 0),
		0
	);
	const totalChargesGlobal = totalRent + totalCharges;
	const pouvoirAchat = salary - totalChargesGlobal;
	return {
		salary,
		totalRent,
		totalCharges,
		totalChargesGlobal,
		pouvoirAchat,
	};
}

function renderSummaryAndSankey() {
	const state = getCurrentMonthState();
	if (!state) return;
	const totals = computeTotals(state);

	document.getElementById("summarySalary").textContent = formatCurrency(
		totals.salary
	);
	document.getElementById("summaryRent").textContent = formatCurrency(
		totals.totalRent
	);
	document.getElementById("summaryCharges").textContent = formatCurrency(
		totals.totalCharges
	);
	document.getElementById("summaryTotalCharges").textContent = formatCurrency(
		totals.totalChargesGlobal
	);
	document.getElementById("summaryPouvoir").textContent = formatCurrency(
		totals.pouvoirAchat
	);

	updateRentComparison(state);

	if (googleChartsLoaded) {
		drawSankey(state);
	}
}

function drawSankey(state) {
	const sankeyDiv = document.getElementById("sankeyChart");
	const emptyP = document.getElementById("sankeyEmpty");
	if (!sankeyDiv) return;

	const totals = computeTotals(state);
	const salary = sanitizeAmount(totals.salary);
	const totalRent = sanitizeAmount(totals.totalRent);
	const totalCharges = sanitizeAmount(totals.totalCharges);
	let pouvoirAchat = sanitizeAmount(totals.pouvoirAchat);

	const NODE_SALAIRE = "Salaire";
	const NODE_RENT = "Logement";
	const NODE_CHARGES = "Charges";
	const NODE_POUVOIR = "Pouvoir d’achat";

	const links = [];

	if (salary > 0) {
		if (totalRent > 0)
			links.push([NODE_SALAIRE, NODE_RENT, totalRent]);
		if (totalCharges > 0)
			links.push([NODE_SALAIRE, NODE_CHARGES, totalCharges]);
		if (pouvoirAchat > 0)
			links.push([NODE_SALAIRE, NODE_POUVOIR, pouvoirAchat]);
	}

	// Level 2: breakdowns
	(state.rentDetails || []).forEach((item) => {
		const amount = sanitizeAmount(item.amount);
		if (amount > 0 && item.label) {
			const childLabel = `Logement - ${item.label}`;
			if (NODE_RENT !== childLabel) {
				links.push([NODE_RENT, childLabel, amount]);
			}
		}
	});

	(state.charges || []).forEach((item) => {
		const amount = sanitizeAmount(item.amount);
		if (amount > 0 && item.label) {
			const childLabel = `Charges - ${item.label}`;
			if (NODE_CHARGES !== childLabel) {
				links.push([NODE_CHARGES, childLabel, amount]);
			}
		}
	});

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

function updateRentComparison(state) {
	const rentSummary = document.getElementById("rentSummary");
	const expectedSpan = document.getElementById("expectedShareValue");
	const loyerProvSpan = document.getElementById("loyerProvisionValue");
	const warning = document.getElementById("rentMismatchWarning");
	if (!rentSummary || !expectedSpan || !loyerProvSpan || !warning) return;

	// Always show a message (neutral / OK / warning)
	warning.classList.remove("hidden");

	const rawBill = Number(state.rentBillTotal);
	const hasBill = Number.isFinite(rawBill) && rawBill > 0;
	const rentBillTotal = hasBill ? rawBill : 0;
	const expectedShare = rentBillTotal / 2;

	let loyerLineAmount = 0;
	let provisionLineAmount = 0;
	(state.rentDetails || []).forEach((item) => {
		if (item.label === "Loyer") {
			loyerLineAmount = Number(item.amount) || 0;
		}
		if (item.label === "Provision pour charges") {
			provisionLineAmount = Number(item.amount) || 0;
		}
	});
	const loyerPlusProvision = loyerLineAmount + provisionLineAmount;

	expectedSpan.textContent = formatCurrency(expectedShare);
	loyerProvSpan.textContent = formatCurrency(loyerPlusProvision);

	rentSummary.classList.remove("rent-check--ok", "rent-check--warning");
	const EPSILON = 0.01;

	if (!hasBill) {
		warning.textContent =
			"Veuillez saisir le loyer facture totale pour vérifier les montants.";
		return;
	}

	const diff = Math.abs(expectedShare - loyerPlusProvision);
	if (diff <= EPSILON) {
		rentSummary.classList.add("rent-check--ok");
		warning.textContent =
			"OK : la part attendue correspond à Loyer + Provision pour charges.";
	} else {
		rentSummary.classList.add("rent-check--warning");
		warning.textContent =
			"Attention : la part attendue (facture / 2) ne correspond pas à Loyer + Provision pour charges.";
	}
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

