// State Management
let localMasterMembers = [
    { nia: "210001", nama: "Ahmad Sakti Wibowo" },
    { nia: "210002", nama: "Siti Rahmawati" },
    { nia: "210003", nama: "Budi Santoso" },
    { nia: "220015", nama: "Dian Permata" },
    { nia: "230089", nama: "Muhammad Fikri" }
];

let liveClockInterval = null;
const SCRIPT_URL_STORAGE_KEY = "ags_gas_api_url";
const DEFAULT_GAS_URL = "https://script.google.com/macros/s/AKfycby5Wk9yFyT78i6a-zz5mhqHGV_5sltX4CwtK6dlACQ1_APt1T1VxXuMZOsByxqsCV69BA/exec";

// DOM Elements
const viewInput = document.getElementById("view-input");
const viewLoading = document.getElementById("view-loading");
const viewSelect = document.getElementById("view-select");
const viewSuccess = document.getElementById("view-success");
const viewError = document.getElementById("view-error");

const niaForm = document.getElementById("nia-form");
const niaInput = document.getElementById("nia-input");
const btnSubmit = document.getElementById("btn-submit");

const candidateList = document.getElementById("candidate-list");
const btnCancelSelect = document.getElementById("btn-cancel-select");

const resNama = document.getElementById("res-nama");
const resNia = document.getElementById("res-nia");
const liveDateText = document.getElementById("live-date-text");
const liveTime = document.getElementById("live-time");
const btnBack = document.getElementById("btn-back");

const errorMessage = document.getElementById("error-message");
const btnRetry = document.getElementById("btn-retry");

const excelMockUpload = document.getElementById("excel-mock-upload");

// Inisialisasi
document.addEventListener("DOMContentLoaded", () => {
    // Setup API URL input jika belum ada di UI
    setupApiConfigUI();

    // Event Listener Form Submit
    niaForm.addEventListener("submit", handleNiaSubmit);

    // Event Listener Navigasi
    btnBack.addEventListener("click", resetToInput);
    btnRetry.addEventListener("click", resetToInput);
    if (btnCancelSelect) {
        btnCancelSelect.addEventListener("click", resetToInput);
    }

    // Event Listener Excel Upload (Uji Coba Lokal)
    if (excelMockUpload) {
        excelMockUpload.addEventListener("change", handleExcelUpload);
    }
});

// Setup Konfigurasi URL Google Apps Script
function setupApiConfigUI() {
    const testingPanel = document.getElementById("local-testing-panel");
    if (!testingPanel) return;

    const savedUrl = localStorage.getItem(SCRIPT_URL_STORAGE_KEY) || "";

    const apiGroup = document.createElement("div");
    apiGroup.className = "api-config-group";
    apiGroup.innerHTML = `
        <label for="gas-url-input"><i class="fas fa-link"></i> URL Google Apps Script Web App:</label>
        <input type="text" id="gas-url-input" placeholder="https://script.google.com/macros/s/.../exec" value="${savedUrl}">
        <p style="font-size: 10px; color: #64748b; margin-top: 4px;">*Jika diisi, verifikasi & rekap akan otomatis terhubung ke Google Sheets Anda.</p>
        <button type="button" id="btn-toggle-admin" style="margin-top: 10px; width: 100%; padding: 8px; font-size: 11px; font-weight: 600; background: #e2e8f0; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer; color: #334155;">
            <i class="fas fa-eye-slash"></i> Sembunyikan Panel Ini (Lihat Tampilan Anggota)
        </button>
    `;

    testingPanel.appendChild(apiGroup);

    const gasInput = document.getElementById("gas-url-input");
    gasInput.addEventListener("change", (e) => {
        localStorage.setItem(SCRIPT_URL_STORAGE_KEY, e.target.value.trim());
    });

    const btnToggleAdmin = document.getElementById("btn-toggle-admin");
    btnToggleAdmin.addEventListener("click", () => {
        testingPanel.style.display = "none";
        
        // Buat tombol kecil tersembunyi di footer untuk membuka kembali jika diperlukan
        let restoreBtn = document.getElementById("restore-admin-btn");
        if (!restoreBtn) {
            restoreBtn = document.createElement("div");
            restoreBtn.id = "restore-admin-btn";
            restoreBtn.style.cssText = "text-align: center; margin-top: 15px; font-size: 10px; color: #9ca3af; cursor: pointer;";
            restoreBtn.innerHTML = "<i class='fas fa-cog'></i> Mode Pengurus";
            restoreBtn.addEventListener("click", () => {
                testingPanel.style.display = "block";
                restoreBtn.remove();
            });
            viewInput.querySelector(".card").appendChild(restoreBtn);
        }
    });
}

// Navigasi Tampilan
function showView(targetView) {
    [viewInput, viewLoading, viewSelect, viewSuccess, viewError].forEach(v => {
        if (v) {
            v.classList.remove("active");
            v.classList.add("hidden");
        }
    });

    if (targetView) {
        targetView.classList.remove("hidden");
        targetView.classList.add("active");
    }
}

function resetToInput() {
    stopLiveClock();
    niaInput.value = "";
    showView(viewInput);
    setTimeout(() => {
        niaInput.focus();
    }, 200);
}

// Handler Submit NIA / Nama
async function handleNiaSubmit(e) {
    e.preventDefault();
    const inputVal = niaInput.value.trim();
    if (!inputVal) return;

    showView(viewLoading);

    const gasUrl = localStorage.getItem(SCRIPT_URL_STORAGE_KEY) || DEFAULT_GAS_URL;

    // Jika URL Google Apps Script sudah diset, panggil API Google Apps Script
    if (gasUrl && gasUrl.startsWith("http")) {
        try {
            await verifyViaGoogleScript(gasUrl, inputVal);
        } catch (err) {
            console.warn("Gagal menghubungi Google Apps Script, mencoba verifikasi data lokal:", err);
            // Fallback ke data lokal jika koneksi offline/gagal
            verifyLocally(inputVal);
        }
    } else {
        // Mode Simulasi Lokal (Demo / Excel Upload)
        setTimeout(() => {
            verifyLocally(inputVal);
        }, 400); // Sedikit delay realistis
    }
}

// Verifikasi via Google Apps Script Web App
async function verifyViaGoogleScript(apiUrl, query) {
    try {
        const response = await fetch(`${apiUrl}?action=verify&nia=${encodeURIComponent(query)}`, {
            method: 'GET',
            redirect: 'follow'
        });

        const result = await response.json();

        if (result.status === "success" && result.data) {
            showSuccessScreen(result.data.nama, result.data.nia);
        } else if (result.status === "multiple" && result.candidates) {
            showCandidateSelector(result.candidates, apiUrl);
        } else {
            showErrorScreen(result.message || "Data anggota tidak ditemukan di database.");
        }
    } catch (error) {
        throw error;
    }
}

// Helper Normalisasi NIA (Menghapus strip, spasi, titik, dsb)
function normalizeNia(val) {
    if (!val) return "";
    return String(val).toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Verifikasi via Data Lokal (Bisa dengan NIA atau Nama)
function verifyLocally(inputQuery) {
    if (!inputQuery) return;
    const rawInput = String(inputQuery).toLowerCase().trim();
    const normInput = normalizeNia(inputQuery);
    const noLeadingZeroInput = normInput.replace(/^0+/, "");

    // 1. Cari berdasarkan NIA
    const niaMatches = localMasterMembers.filter(m => {
        const rawM = String(m.nia || "").toLowerCase().trim();
        const normM = normalizeNia(m.nia);
        
        if (rawM === rawInput) return true;
        if (normM === normInput && normInput !== "") return true;

        const segments = rawM.split(/[^a-z0-9]+/i).filter(Boolean);
        if (segments.some(seg => seg === rawInput || (rawInput.length >= 4 && seg.replace(/^0+/, "") === noLeadingZeroInput))) {
            return true;
        }

        if (normInput.length >= 5 && normM.includes(normInput)) return true;
        return false;
    });

    // 2. Cari berdasarkan Nama Anggota (mengandung teks yang diketik)
    const nameMatches = localMasterMembers.filter(m => {
        const memberName = String(m.nama || "").toLowerCase().trim();
        return memberName.includes(rawInput);
    });

    // Gabungkan hasil pencarian (hilangkan duplikat)
    const combinedMap = new Map();
    niaMatches.forEach(m => combinedMap.set(m.nia, m));
    nameMatches.forEach(m => combinedMap.set(m.nia, m));
    const allMatches = Array.from(combinedMap.values());

    if (allMatches.length === 1) {
        const found = allMatches[0];
        recordLocalTransaction(found);
        showSuccessScreen(found.nama, found.nia);
    } else if (allMatches.length > 1) {
        showCandidateSelector(allMatches, null);
    } else {
        showErrorScreen(`Data anggota "${inputQuery}" tidak terdaftar di master data anggota.`);
    }
}

// Tampilkan Pemilih Nama Jika Ditemukan Lebih Dari 1 Anggota
function showCandidateSelector(candidates, apiUrl) {
    if (!candidateList) return;
    candidateList.innerHTML = "";

    candidates.forEach(c => {
        const item = document.createElement("div");
        item.className = "candidate-item";
        item.innerHTML = `
            <div class="candidate-info">
                <div class="candidate-name">${c.nama}</div>
                <div class="candidate-nia">NIA: ${c.nia}</div>
            </div>
            <i class="fas fa-chevron-right candidate-arrow"></i>
        `;
        item.addEventListener("click", () => {
            if (apiUrl) {
                showView(viewLoading);
                verifyViaGoogleScript(apiUrl, c.nia);
            } else {
                recordLocalTransaction(c);
                showSuccessScreen(c.nama, c.nia);
            }
        });
        candidateList.appendChild(item);
    });

    showView(viewSelect);
}

// Tampilkan Layar Sukses dengan Live Clock
function showSuccessScreen(nama, nia) {
    resNama.textContent = nama;
    resNia.textContent = nia;

    startLiveClock();
    showView(viewSuccess);
}

// Tampilkan Layar Error
function showErrorScreen(msg) {
    errorMessage.textContent = msg;
    showView(viewError);
}

// Jam Digital Real-time dengan Tanggal, Hari, dan Detik Bergerak (Bukti Otentik ke Kasir)
function startLiveClock() {
    stopLiveClock();
    updateClock();
    liveClockInterval = setInterval(updateClock, 1000);
}

function updateClock() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const hours = pad(now.getHours());
    const minutes = pad(now.getMinutes());
    const seconds = pad(now.getSeconds());
    
    if (liveTime) {
        liveTime.textContent = `${hours}:${minutes}:${seconds}`;
    }

    if (liveDateText) {
        const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
        liveDateText.textContent = now.toLocaleDateString('id-ID', options);
    }
}

function stopLiveClock() {
    if (liveClockInterval) {
        clearInterval(liveClockInterval);
        liveClockInterval = null;
    }
}

// Handler Upload Excel Lokal
function handleExcelUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, { type: 'array' });

            // Ambil sheet pertama
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            if (jsonData.length <= 1) {
                alert("File Excel kosong atau tidak memiliki data.");
                return;
            }

            // Auto-detect kolom berdasarkan nama header (No, NIA, Nama)
            const headerRow = jsonData[0] || [];
            let niaColIdx = -1;
            let namaColIdx = -1;

            headerRow.forEach((col, idx) => {
                const colName = String(col || "").toLowerCase().trim();
                if (colName.includes("nia") || colName.includes("induk") || colName.includes("id")) {
                    niaColIdx = idx;
                }
                if (colName.includes("nama") || colName.includes("name") || colName.includes("anggota")) {
                    namaColIdx = idx;
                }
            });

            // Fallback jika tidak ada header atau tidak terdeteksi otomatis:
            // Sesuai format Anda: Kolom A = No (0), Kolom B = NIA (1), Kolom C = Nama (2)
            if (niaColIdx === -1) {
                niaColIdx = headerRow.length >= 3 ? 1 : 0;
            }
            if (namaColIdx === -1) {
                namaColIdx = headerRow.length >= 3 ? 2 : 1;
            }

            // Parsing data baris (melewati baris header ke-0)
            let parsed = [];
            for (let i = 1; i < jsonData.length; i++) {
                const row = jsonData[i];
                if (row && row[niaColIdx] !== undefined && row[niaColIdx] !== null && String(row[niaColIdx]).trim() !== "") {
                    parsed.push({
                        nia: String(row[niaColIdx]).trim(),
                        nama: row[namaColIdx] ? String(row[namaColIdx]).trim() : "Anggota Kopma"
                    });
                }
            }

            if (parsed.length > 0) {
                localMasterMembers = parsed;
                alert(`Berhasil memuat ${parsed.length} data anggota dari file Excel "${file.name}"!\n\nStruktur terdeteksi:\n- Kolom NIA: Kolom ke-${niaColIdx + 1} (${headerRow[niaColIdx] || 'NIA'})\n- Kolom Nama: Kolom ke-${namaColIdx + 1} (${headerRow[namaColIdx] || 'Nama'})\n\nSilakan coba ketik salah satu NIA anggota Anda di atas.`);
            } else {
                alert("Tidak dapat menemukan data NIA pada file yang diupload. Pastikan ada kolom NIA.");
            }
        } catch (err) {
            console.error(err);
            alert("Gagal membaca file Excel. Pastikan format file .xlsx atau .xls valid.");
        }
    };
    reader.readAsArrayBuffer(file);
}

// Rekap Transaksi Lokal (Simulasi)
function recordLocalTransaction(member) {
    let history = JSON.parse(localStorage.getItem("ags_local_transactions") || "[]");
    const now = new Date();
    history.push({
        timestamp: now.toISOString(),
        tanggal: now.toLocaleDateString('id-ID'),
        jam: now.toLocaleTimeString('id-ID'),
        nia: member.nia,
        nama: member.nama
    });
    localStorage.setItem("ags_local_transactions", JSON.stringify(history));
}
