let currentUser = {
    token: localStorage.getItem("token"),
    role: localStorage.getItem("role")
};

// Session migration for those who logged in during the previous update
if (!currentUser.token) {
    try {
        const legacy = JSON.parse(localStorage.getItem("currentUser") || "null");
        if (legacy && legacy.token) {
            currentUser.token = legacy.token;
            currentUser.role = legacy.role;
            localStorage.setItem("token", legacy.token);
            localStorage.setItem("role", legacy.role);
        }
    } catch (e) { console.error("Migration error:", e); }
}

let inventoryCache = []; // Global cache for inventory items
let userCache = []; // Global cache for users
let editingId = null; // Track if we are editing an item

let currentEntryType = 'Asset';
let currentViewType = 'Asset';
let currentManageType = 'Asset';

window.onload = () => {
    if (currentUser.token) {
        showPanel(currentUser.role);
    }
    initFormListeners();
};

function initFormListeners() {
    const empNoInput = document.getElementById("empNo_form");
    if (empNoInput) {
        empNoInput.addEventListener("input", debounce(async (e) => {
            const empNo = e.target.value;
            if (empNo && empNo.length >= 4) {
                await fetchEmployeeName(empNo);
            }
        }, 500));
    }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

async function fetchEmployeeName(empNo) {
    try {
        const res = await fetch(`/api/Auth/employee/${empNo}`, {
            headers: { "Authorization": `Bearer ${currentUser.token}` }
        });
        if (res.ok) {
            const data = await res.json();
            document.getElementById("currentlyIssuedTo").value = data.fullName || "";
            // Optional: highlight success
            document.getElementById("empNo_form").style.borderColor = "#10b981";
        } else {
            // document.getElementById("currentlyIssuedTo").value = "";
            document.getElementById("empNo_form").style.borderColor = "#ef4444";
        }
    } catch (error) {
        console.error("Fetch Error:", error);
    }
}

//  LOGIN FUNCTIONS 

function togglePassword() {
    const pwd = document.getElementById("password");
    const eyeIcon = document.getElementById("eyeIcon");
    if (pwd.type === "password") {
        pwd.type = "text";
        eyeIcon.classList.replace("fa-eye", "fa-eye-slash");
    } else {
        pwd.type = "password";
        eyeIcon.classList.replace("fa-eye-slash", "fa-eye");
    }
}

function forgotPassword() {
    const empNo = document.getElementById("empNo").value;
    if (!empNo) {
        alert("Please enter your Employee Number first.");
        return;
    }
    alert("Password reset link has been sent to the email associated with Employee No: " + empNo);
}

// LOGIN =================

async function login() {
    const empNo = document.getElementById("empNo").value;
    const password = document.getElementById("password").value;

    if (!empNo || !password) {
        alert("Please enter both Employee Number and password");
        return;
    }

    try {
        const res = await fetch("/api/Auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ empNo, password })
        });

        if (!res.ok) {
            alert("Authentication failed. Invalid ID or Security Key.");
            return;
        }

        const data = await res.json();
        currentUser = {
            token: data.token,
            role: data.role
        };

        localStorage.setItem("token", data.token);
        localStorage.setItem("role", data.role);

        showPanel(data.role);

    } catch (error) {
        console.error("Auth Failure:", error);
        alert("Connectivity error. System offline.");
    }
}

function showPanel(role) {
    document.getElementById("loginPage").classList.add("hidden");
    if (role === "Admin") {
        document.getElementById("adminPanel").classList.remove("hidden");
        loadInventory();
        loadUsers();
        showReportsDashboard(); // Default section
    } else {
        document.getElementById("employeePanel").classList.remove("hidden");
        loadInventory();
    }
}

function logout() {
    localStorage.clear();
    location.reload();
}

function hideAllAdminSections() {
    ['reportSection', 'addForm', 'manageSection', 'reportsDashboard', 'employeeReportSection'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.classList.add('hidden');
    });
}

function showAddForm() {
    hideAllAdminSections();
    document.getElementById("addForm").classList.remove("hidden");
    setEntryType(currentEntryType);
    if (!editingId) clearForm();
}

function showViewSection() {
    hideAllAdminSections();
    const section = document.getElementById("viewSection");
    if (section) section.classList.remove("hidden");
    setViewType(currentViewType);
}

function showManageSection() {
    hideAllAdminSections();
    const section = document.getElementById("manageSection");
    if (section) section.classList.remove("hidden");
    setManageType(currentManageType);
}

function showReportsDashboard() {
    hideAllAdminSections();
    const db = document.getElementById("reportsDashboard");
    if(db) db.classList.remove("hidden");
}

function showAssetReports() {
    hideAllAdminSections();
    document.getElementById("reportSection").classList.remove("hidden");
    generateReport();
}

function showEmployeeReports() {
    hideAllAdminSections();
    const sec = document.getElementById("employeeReportSection");
    if(sec) sec.classList.remove("hidden");
    
    const searchEl = document.getElementById("empReportSearch");
    if (searchEl) searchEl.value = "";
    const fromEl = document.getElementById("empReportFromDate");
    if (fromEl) fromEl.value = "";
    const toEl = document.getElementById("empReportToDate");
    if (toEl) toEl.value = "";
    
    filterEmployeeReport();
}

function filterEmployeeReport() {
    const searchVal = document.getElementById("empReportSearch").value.toLowerCase().trim();
    const fromDateVal = document.getElementById("empReportFromDate").value;
    const toDateVal = document.getElementById("empReportToDate").value;
    
    if (fromDateVal && toDateVal && new Date(fromDateVal) > new Date(toDateVal)) {
        document.getElementById("employeeReportDetails").innerHTML = "<p style='padding: 20px; color: #ef4444; font-weight: 500;'>Error: From Date cannot be greater than To Date.</p>";
        return;
    }
    
    let filteredUsers = userCache || [];
    
    if (searchVal) {
        filteredUsers = filteredUsers.filter(u => 
            (u.empNo && u.empNo.toLowerCase().includes(searchVal)) || 
            (u.fullName && u.fullName.toLowerCase().includes(searchVal))
        );
    }
    
    renderEmployeeReport(filteredUsers, fromDateVal, toDateVal);
}

function renderEmployeeReport(users, fromStr, toStr) {
    const container = document.getElementById("employeeReportDetails");
    if (!container) return;

    const fromDate = fromStr ? new Date(fromStr) : null;
    const toDate = toStr ? new Date(toStr) : null;
    if (toDate) {
        toDate.setHours(23, 59, 59, 999);
    }
    
    let html = `
        <div class="inventory-table-container">
            <table>
                <thead>
                    <tr>
                        <th>Emp No</th>
                        <th>Full Name</th>
                        <th>Department</th>
                        <th>Role</th>
                        <th>Assigned Assets (Filtered)</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    let renderedCount = 0;
    
    const rowsHtml = users.map(u => {
        let assigned = inventoryCache.filter(item => item.empNo === u.empNo && item.status === 'Issued');
        
        if (fromDate || toDate) {
            assigned = assigned.filter(a => {
                if (!a.issuedDate) return false;
                const idate = new Date(a.issuedDate);
                if (fromDate && idate < fromDate) return false;
                if (toDate && idate > toDate) return false;
                return true;
            });
        }
        
        if ((fromDate || toDate) && assigned.length === 0) {
            return '';
        }

        renderedCount++;
        
        const assetsHtml = assigned.length > 0 
            ? assigned.map(a => `<div style="margin-bottom:4px; line-height:1.2;"><strong>${a.productType}</strong>: ${a.makeAndModel || a.assetId || '-'} <br><span style="font-size:10px; color:var(--text-muted);">Issued: ${formatDate(a.issuedDate)}</span></div>`).join("") 
            : '<span style="color: var(--text-muted); font-size: 11px;">No assets assigned</span>';
        
        return `
        <tr>
            <td>${u.empNo || '-'}</td>
            <td>${u.fullName || '-'}</td>
            <td>${u.department || '-'}</td>
            <td>${u.role === 0 || u.role === 'Admin' ? 'Admin' : 'Employee'}</td>
            <td>${assetsHtml}</td>
        </tr>
        `;
    }).join("");
    
    if (renderedCount === 0) {
        html += `<tr><td colspan="5" style="text-align: center; padding: 20px;">No employees found matching the given criteria.</td></tr>`;
    } else {
        html += rowsHtml;
    }
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    container.innerHTML = html;
}

function setEntryType(type) {
    currentEntryType = type;
    document.getElementById('btn-add-asset').classList.toggle('active', type === 'Asset');
    document.getElementById('btn-add-employee').classList.toggle('active', type === 'Employee');
    document.getElementById('assetFormFields').classList.toggle('hidden', type !== 'Asset');
    document.getElementById('employeeFormFields').classList.toggle('hidden', type !== 'Employee');
    document.getElementById('addHeading').innerText = `${type} Entry`;
}

function setViewType(type) {
    currentViewType = type;
    document.getElementById('btn-view-asset').classList.toggle('active', type === 'Asset');
    document.getElementById('btn-view-employee').classList.toggle('active', type === 'Employee');
    document.getElementById('viewHeading').innerText = `${type} Entry`;
    
    const searchContainer = document.getElementById('viewSearchContainer');
    if(searchContainer) searchContainer.classList.toggle('hidden', type !== 'Employee');
    
    renderViewData();
}

function setManageType(type) {
    currentManageType = type;
    document.getElementById('btn-manage-asset').classList.toggle('active', type === 'Asset');
    document.getElementById('btn-manage-employee').classList.toggle('active', type === 'Employee');
    document.getElementById('manageHeading').innerText = `Manage ${type}s`;
    
    const searchContainer = document.getElementById('manageSearchContainer');
    if(searchContainer) searchContainer.classList.toggle('hidden', type !== 'Employee');
    
    renderManageData();
}

async function loadUsers() {
    try {
        const res = await fetch("/api/Auth/users", {
            headers: { "Authorization": `Bearer ${currentUser.token}` }
        });
        if (res.ok) {
            const data = await res.json();
            userCache = data;
            if (currentUser.role === "Admin") {
                renderManageData();
            }
        }
    } catch (e) {
        console.error("Failed to load users", e);
    }
}

let currentTypeFilter = "All";

function filterReportByType(type, btn) {
    currentTypeFilter = type;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    generateReport();
}

function clearAssetFilters() {
    const searchInput = document.getElementById("assetReportSearch");
    const fromInput = document.getElementById("assetReportFromDate");
    const toInput = document.getElementById("assetReportToDate");
    
    if (searchInput) searchInput.value = "";
    if (fromInput) fromInput.value = "";
    if (toInput) toInput.value = "";
    
    currentTypeFilter = "All";
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    // Select the first All Category button:
    const btnAll = document.querySelector('.filter-btn');
    if (btnAll) btnAll.classList.add('active');
    
    generateReport();
}

function generateReport() {
    if (!inventoryCache || inventoryCache.length === 0) {
        if (currentUser.token) loadInventory();
        document.getElementById("reportDetails").innerHTML = "<p style='padding:20px; text-align:center;'>Initializing report data...</p>";
        return;
    }

    let filteredCache = [];
    if (currentTypeFilter === "All") {
        filteredCache = inventoryCache;
    } else if (currentTypeFilter === "Other") {
        const knownTypes = ["laptop", "desktop", "printer", "scanner", "pendrive"];
        filteredCache = inventoryCache.filter(i => {
            if (!i.productType) return true;
            const t = i.productType.toLowerCase();
            return !knownTypes.some(kt => t.includes(kt));
        });
    } else {
        filteredCache = inventoryCache.filter(i =>
            i.productType && i.productType.toLowerCase().includes(currentTypeFilter.toLowerCase())
        );
    }

    const searchVal = (document.getElementById("assetReportSearch")?.value || "").toLowerCase().trim();
    const fromDateVal = document.getElementById("assetReportFromDate")?.value;
    const toDateVal = document.getElementById("assetReportToDate")?.value;

    if (fromDateVal && toDateVal && new Date(fromDateVal) > new Date(toDateVal)) {
        document.getElementById("reportDetails").innerHTML = "<p style='padding: 20px; color: #ef4444; font-weight: 500;'>Error: From Date cannot be greater than To Date.</p>";
        return;
    }

    if (searchVal) {
        filteredCache = filteredCache.filter(i => {
            return (
                (i.makeAndModel && i.makeAndModel.toLowerCase().includes(searchVal)) ||
                (i.currentlyIssuedTo && i.currentlyIssuedTo.toLowerCase().includes(searchVal)) ||
                (i.empNo && i.empNo.toLowerCase().includes(searchVal)) ||
                (i.productType && i.productType.toLowerCase().includes(searchVal)) ||
                (i.assetId && i.assetId.toLowerCase().includes(searchVal))
            );
        });
    }

    if (fromDateVal || toDateVal) {
        let fromD = fromDateVal ? new Date(fromDateVal) : null;
        let toD = toDateVal ? new Date(toDateVal) : null;
        if (toD) toD.setHours(23, 59, 59, 999);

        filteredCache = filteredCache.filter(i => {
            const dateStr = i.status === 'Issued' ? i.issuedDate : i.purchaseDate;
            if (!dateStr) return false;
            const d = new Date(dateStr);
            if (fromD && d < fromD) return false;
            if (toD && d > toD) return false;
            return true;
        });
    }

    const total = filteredCache.length;
    const inStock = filteredCache.filter(i => i.status === "Available").length;
    const issued = filteredCache.filter(i => i.status === "Issued").length;

    document.getElementById("totalAssets").innerText = total;
    document.getElementById("inStockAssets").innerText = inStock;
    document.getElementById("issuedAssets").innerText = issued;

    let html = `
        <div style="margin-top: 20px;">
            <h4 style="margin-bottom: 15px; font-size: 16px; color: var(--text-main);">Inventory Master List (${currentTypeFilter})</h4>
            <div class="inventory-table-container">
                <table id="reportTable" style="font-size: 11px;">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Type</th>
                            <th>Make & Model</th>
                            <th>Status</th>
                            <th>Assignee</th>
                            <th>Emp No</th>
                            <th>Date</th>
                            <th>Location</th>
                            <th>Specifications</th>
                            <th>Remarks</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredCache.length > 0 ? filteredCache.map(item => `
                            <tr>
                                <td>${item.id}</td>
                                <td>${item.productType}</td>
                                <td>
                                    <a href="#" onclick="showHistory(${item.id}, '${item.productType}'); return false;" style="color: #2563eb; text-decoration: underline; font-weight: 500;" title="Click to view history report">
                                        ${item.makeAndModel || '-'}
                                    </a>
                                </td>
                                <td><span class="status-badge ${item.status === 'Available' ? 'status-available' : 'status-issued'}">${item.status}</span></td>
                                <td>${item.currentlyIssuedTo || '-'}</td>
                                <td>${item.empNo || '-'}</td>
                                <td>${formatDate(item.status === 'Issued' ? item.issuedDate : item.purchaseDate)}</td>
                                <td>${item.inventoryLocation || '-'}</td>
                                <td>${item.specifications || '-'}</td>
                                <td>${item.remarks || '-'}</td>
                            </tr>
                        `).join("") : '<tr><td colspan="10" style="text-align: center; padding: 20px;">No data found matching your filters.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    document.getElementById("reportDetails").innerHTML = html;
}

// ================= DATA LOGIC =================

function getFormData() {
    return {
        serialNo: document.getElementById("serialNo").value,
        productType: document.getElementById("productType").value,
        makeAndModel: document.getElementById("makeAndModel").value,
        purchaseDate: document.getElementById("purchaseDate").value || null,
        qty: parseInt(document.getElementById("qty").value) || 0,
        stockRegister: document.getElementById("stockRegister").value,
        assetId: document.getElementById("assetId").value,
        status: document.getElementById("status").value,
        currentlyIssuedTo: document.getElementById("currentlyIssuedTo").value,
        empNo: document.getElementById("empNo_form").value,
        issuedDate: document.getElementById("issuedDate").value || null,
        referenceFileNo: document.getElementById("referenceFileNo").value,
        inventoryLocation: document.getElementById("inventoryLocation").value,
        specifications: document.getElementById("specifications").value,
        remarks: document.getElementById("remarks").value
    };
}

async function addInventory() {
    const data = getFormData();

    // NEW: Check if record already exists by Make & Model to avoid duplicates
    const existing = inventoryCache.find(i => i.makeAndModel === data.makeAndModel);
    if (existing) {
        if (confirm(`A record with Make & Model ${data.makeAndModel} already exists (${existing.productType}). Do you want to update the existing record instead of creating a new one?`)) {
            editingId = existing.id;
            updateInventory();
            return;
        }
    }

    try {
        const res = await fetch("/api/Inventory", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${currentUser.token}`
            },
            body: JSON.stringify(data)
        });

        if (res.ok) {
            alert("Record synchronized successfully");
            clearForm();
            loadInventory();
        } else {
            const err = await res.text();
            alert("Database Error: " + err);
        }
    } catch (error) { console.error("Sync Failure:", error); }
}

async function updateInventory() {
    if (!editingId) return;
    const data = getFormData();
    try {
        const res = await fetch(`/api/Inventory/${editingId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${currentUser.token}`
            },
            body: JSON.stringify(data)
        });

        if (res.ok) {
            alert("Record updated successfully");
            cancelEdit();
            loadInventory();
        } else {
            const err = await res.text();
            alert("Update Failure: " + err);
        }
    } catch (error) { console.error("Sync Failure:", error); }
}

async function deleteInventory(id) {
    if (!confirm("Are you sure you want to permanently delete this record?")) return;
    try {
        const res = await fetch(`/api/Inventory/${id}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${currentUser.token}` }
        });
        if (res.ok) {
            alert("Record purged from database");
            loadInventory();
        } else {
            alert("Purge operation failed.");
        }
    } catch (error) { console.error("Sync Failure:", error); }
}

//  UI HELPERS 

function editInventory(item) {
    editingId = item.id;
    document.getElementById("serialNo").value = item.serialNo || "";
    document.getElementById("productType").value = item.productType || "";
    document.getElementById("makeAndModel").value = item.makeAndModel || "";
    document.getElementById("purchaseDate").value = item.purchaseDate ? item.purchaseDate.split('T')[0] : "";
    document.getElementById("qty").value = item.qty;
    document.getElementById("stockRegister").value = item.stockRegister || "";
    document.getElementById("assetId").value = item.assetId || "";
    document.getElementById("status").value = item.status;
    document.getElementById("currentlyIssuedTo").value = item.currentlyIssuedTo || "";
    document.getElementById("empNo_form").value = item.empNo || "";
    document.getElementById("issuedDate").value = item.issuedDate ? item.issuedDate.split('T')[0] : "";
    document.getElementById("referenceFileNo").value = item.referenceFileNo || "";
    document.getElementById("inventoryLocation").value = item.inventoryLocation || "";
    document.getElementById("specifications").value = item.specifications || "";
    document.getElementById("remarks").value = item.remarks || "";

    document.getElementById("addForm").classList.remove("hidden");
    document.getElementById("saveBtn").classList.add("hidden");
    document.getElementById("updateBtn").classList.remove("hidden");
    document.getElementById("cancelBtn").classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelEdit() {
    editingId = null;
    clearForm();
    document.getElementById("saveBtn").classList.remove("hidden");
    document.getElementById("updateBtn").classList.add("hidden");
    document.getElementById("cancelBtn").classList.add("hidden");
}

function clearForm() {
    const inputs = document.querySelectorAll("#addForm input, #addForm select");
    inputs.forEach(i => i.value = "");
    document.getElementById("status").value = "Available";
}

// Memory cache for items to avoid JSON.stringify issues in HTML attributes

async function loadInventory() {
    try {
        const res = await fetch("/api/Inventory", {
            headers: { "Authorization": `Bearer ${currentUser.token}` }
        });
        if (!res.ok) {
            if (res.status === 401) logout();
            return;
        }

        const items = await res.json();
        inventoryCache = items; // Store in cache

        if (currentUser.role === "Admin") {
            renderManageData();
        } else {
            const container = document.getElementById("employeeInventory");
            if (!container) return;
            container.innerHTML = `
                <div class="inventory-table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Product Type</th>
                                <th>Make & Model</th>
                                <th>Issued Date</th>
                                <th>Specifications</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody id="employeeTableBody"></tbody>
                    </table>
                </div>
            `;
            const tbody = document.getElementById("employeeTableBody");
            items.forEach((item, index) => {
                const row = document.createElement("tr");
                row.innerHTML = `
                    <td>${item.productType}</td>
                    <td>${item.makeAndModel || '-'}</td>
                    <td>${formatDate(item.issuedDate)}</td>
                    <td>${item.specifications || '-'}</td>
                    <td>
                        <span class="status-badge ${item.status === 'Available' ? 'status-available' : 'status-issued'}" style="padding: 2px 8px; font-size: 10px;">
                            ${item.status === 'Issued' ? 'Not Submitted' : 'Submitted'}
                        </span>
                    </td>
                `;
                tbody.appendChild(row);
            });
        }
    } catch (error) { console.error(error); }
}

function renderViewData() {
    const container = document.getElementById("inventoryList");
    if (!container) return;

    if (currentViewType === 'Asset') {
        const items = inventoryCache;
        container.innerHTML = `
            <div class="inventory-table-container">
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Type</th>
                            <th>S.No (Sys)</th>
                            <th>Make & Model</th>
                            <th>Purchase</th>
                            <th>Qty</th>
                            <th>Stock Register</th>
                            <th>Asset ID</th>
                            <th>Status</th>
                            <th>Issued To</th>
                            <th>Emp No</th>
                            <th>Issued Date</th>
                            <th>Ref File</th>
                            <th>Location</th>
                            <th>Specifications</th>
                            <th>Remarks</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map(item => `
                            <tr>
                                <td>${item.id}</td>
                                <td>${item.productType}</td>
                                <td>${item.serialNo || '-'}</td>
                                <td>${item.makeAndModel || '-'}</td>
                                <td>${formatDate(item.purchaseDate)}</td>
                                <td>${item.qty}</td>
                                <td>${item.stockRegister || '-'}</td>
                                <td>${item.assetId || '-'}</td>
                                <td><span class="status-badge ${item.status === 'Available' ? 'status-available' : 'status-issued'}">${item.status}</span></td>
                                <td>${item.currentlyIssuedTo || '-'}</td>
                                <td>${item.empNo || '-'}</td>
                                <td>${formatDate(item.issuedDate)}</td>
                                <td>${item.referenceFileNo || '-'}</td>
                                <td>${item.inventoryLocation || '-'}</td>
                                <td>${item.specifications || '-'}</td>
                                <td>${item.remarks || '-'}</td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            </div>
        `;
    } else {
        let users = userCache || [];
        const srch = document.getElementById('viewEmployeeSearch');
        if (srch && srch.value.trim()) {
            const term = srch.value.trim().toLowerCase();
            users = users.filter(u => u.empNo && u.empNo.toLowerCase().includes(term));
        }
        
        container.innerHTML = `
            <div class="inventory-table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Emp No</th>
                            <th>Full Name</th>
                            <th>Department</th>
                            <th>Role</th>
                            <th>Assigned Assets</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${users.map((u) => {
                            const assigned = inventoryCache.filter(item => item.empNo === u.empNo && item.status === 'Issued');
                            const assetsHtml = assigned.length > 0 
                                ? assigned.map(a => `<div style="margin-bottom:4px; line-height:1.2;"><strong>${a.productType}</strong>: ${a.makeAndModel || a.assetId || '-'} <br><span style="font-size:10px; color:var(--text-muted);">Issued: ${formatDate(a.issuedDate)}</span></div>`).join("") 
                                : '<span style="color: var(--text-muted); font-size: 11px;">No assets assigned</span>';
                            return `
                            <tr>
                                <td>${u.empNo}</td>
                                <td>${u.fullName || '-'}</td>
                                <td>${u.department || '-'}</td>
                                <td>${u.role === 0 ? 'Admin' : 'Employee'}</td>
                                <td>${assetsHtml}</td>
                            </tr>
                            `;
                        }).join("")}
                    </tbody>
                </table>
            </div>
        `;
    }
}

function renderManageData() {
    const container = document.getElementById("manageList");
    if (!container) return;

    if (currentManageType === 'Asset') {
        const items = inventoryCache;
        container.innerHTML = `
            <div class="inventory-table-container">
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Type</th>
                            <th>S.No (Sys)</th>
                            <th>Make & Model</th>
                            <th>Purchase</th>
                            <th>Qty</th>
                            <th>Stock Register</th>
                            <th>Asset ID</th>
                            <th>Status</th>
                            <th>Issued To</th>
                            <th>Emp No</th>
                            <th>Issued Date</th>
                            <th>Ref File</th>
                            <th>Location</th>
                            <th>Specifications</th>
                            <th>Remarks</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map((item, index) => `
                            <tr>
                                <td>${item.id}</td>
                                <td>${item.productType}</td>
                                <td>${item.serialNo || '-'}</td>
                                <td>${item.makeAndModel || '-'}</td>
                                <td>${formatDate(item.purchaseDate)}</td>
                                <td>${item.qty}</td>
                                <td>${item.stockRegister || '-'}</td>
                                <td>${item.assetId || '-'}</td>
                                <td><span class="status-badge ${item.status === 'Available' ? 'status-available' : 'status-issued'}">${item.status}</span></td>
                                <td>${item.currentlyIssuedTo || '-'}</td>
                                <td>${item.empNo || '-'}</td>
                                <td>${formatDate(item.issuedDate)}</td>
                                <td>${item.referenceFileNo || '-'}</td>
                                <td>${item.inventoryLocation || '-'}</td>
                                <td>${item.specifications || '-'}</td>
                                <td>${item.remarks || '-'}</td>
                                <td>
                                    <button onclick='startEdit(${index})' class="edit-btn" style="background: #fbbf24;"><i class="fas fa-edit"></i></button>
                                    <button onclick='deleteInventory(${item.id})' class="delete-btn" style="background: #ef4444;"><i class="fas fa-trash"></i></button>
                                </td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            </div>
        `;
    } else {
        let users = userCache || [];
        const srch = document.getElementById('manageEmployeeSearch');
        if (srch && srch.value.trim()) {
            const term = srch.value.trim().toLowerCase();
            users = users.filter(u => u.empNo && u.empNo.toLowerCase().includes(term));
        }

        container.innerHTML = `
            <div class="inventory-table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Emp No</th>
                            <th>Full Name</th>
                            <th>Department</th>
                            <th>Role</th>
                            <th>Assigned Assets</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${users.map((u) => {
                            const assigned = inventoryCache.filter(item => item.empNo === u.empNo && item.status === 'Issued');
                            const assetsHtml = assigned.length > 0 
                                ? assigned.map(a => `<div style="margin-bottom:4px; line-height:1.2;"><strong>${a.productType}</strong>: ${a.makeAndModel || a.assetId || '-'} <br><span style="font-size:10px; color:var(--text-muted);">Issued: ${formatDate(a.issuedDate)}</span></div>`).join("") 
                                : '<span style="color: var(--text-muted); font-size: 11px;">No assets assigned</span>';
                            return `
                            <tr>
                                <td>${u.empNo}</td>
                                <td>${u.fullName || '-'}</td>
                                <td>${u.department || '-'}</td>
                                <td>${u.role === 0 ? 'Admin' : 'Employee'}</td>
                                <td>${assetsHtml}</td>
                            </tr>
                            `;
                        }).join("")}
                    </tbody>
                </table>
            </div>
        `;
    }
}

function submitEntry() {
    if (currentEntryType === 'Asset') {
        addInventory();
    } else {
        registerEmployee();
    }
}

function updateEntry() {
    if (currentEntryType === 'Asset') {
        updateInventory();
    } else {
        alert("Employee editing not implemented in this view yet.");
    }
}

async function registerEmployee() {
    let empNoVal = document.getElementById('emp_empNo').value.trim();
    if (!/^\d+$/.test(empNoVal)) {
        alert("Invalid Employee Number. Only pure numeric values are allowed.");
        return;
    }

    const data = {
        empNo: empNoVal,
        fullName: document.getElementById('emp_fullName').value,
        department: document.getElementById('emp_department').value,
        password: document.getElementById('emp_password').value,
        role: document.getElementById('emp_role').value
    };

    if (!data.empNo || !data.password) {
        alert("Employee Number and Password are required");
        return;
    }

    try {
        const res = await fetch("/api/Auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });

        if (res.ok) {
            alert("Employee registered successfully");
            ['emp_empNo', 'emp_fullName', 'emp_department', 'emp_password'].forEach(id => document.getElementById(id).value = "");
            loadUsers();
        } else {
            const err = await res.text();
            alert("Registration failed: " + err);
        }
    } catch (e) { console.error(e); }
}

async function deleteUser(id) {
    if (!confirm("Delete this user?")) return;
    alert("Delete functionality for users usually requires a specific endpoint. Skipping in UI for now.");
}

function startEdit(index) {
    const item = inventoryCache[index];
    showAddForm();
    setEntryType('Asset');
    editInventory(item);
}

function formatDate(dateStr) {
    if (!dateStr || dateStr.startsWith("0001")) return "-";
    const d = new Date(dateStr);
    return isNaN(d) ? "-" : d.toLocaleDateString();
}


async function exportReportToExcel() {
    const table = document.getElementById("reportTable");
    if (!table) {
        alert("No data available to export.");
        return;
    }

    const rows = Array.from(table.querySelectorAll("tbody tr")).filter(tr => tr.style.display !== "none");
    if (rows.length === 0 || (rows.length === 1 && rows[0].innerText.includes("No assets found"))) {
        alert("No visible data to export.");
        return;
    }

    try {
        const btn = document.querySelector(".export-btn");
        const originalText = btn.innerHTML;
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Generating Excel...`;
        btn.disabled = true;

        const res = await fetch(`/api/Inventory/export?type=${encodeURIComponent(currentTypeFilter)}`, {
            headers: { "Authorization": `Bearer ${currentUser.token}` }
        });

        if (!res.ok) {
            alert("Failed to export Excel file from server.");
            btn.innerHTML = originalText;
            btn.disabled = false;
            return;
        }

        const blob = await res.blob();
        
        // Ensure browser treats it as proper excel type
        const newBlob = new Blob([blob], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const url = URL.createObjectURL(newBlob);
        
        const fileName = `TCIL_Inventory_Report_${currentTypeFilter}_${new Date().toISOString().split('T')[0]}.xlsx`;
        
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            btn.innerHTML = originalText;
            btn.disabled = false;
        }, 100);
        
    } catch (error) {
        console.error("Export Error:", error);
        alert("Failed to export Excel file. Please try again.");
        const btn = document.querySelector(".export-btn");
        if(btn) {
            btn.innerHTML = `<i class="fas fa-file-excel"></i> Export to MS Excel`;
            btn.disabled = false;
        }
    }
}

// HISTORY LOGIC 
async function showHistory(inventoryId, productName) {
    const modal = document.getElementById("historyModal");
    const content = document.getElementById("historyContent");
    const title = document.getElementById("historyTitle");

    title.innerText = `Issue History: ${productName} (ID: ${inventoryId})`;
    content.innerHTML = "<p style='padding:20px; text-align:center;'>Loading history...</p>";
    modal.classList.remove("hidden");
    modal.style.display = "flex";

    try {
        const res = await fetch(`/api/AssetHistory/${inventoryId}`, {
            headers: { "Authorization": `Bearer ${currentUser.token}` }
        });

        if (!res.ok) {
            content.innerHTML = `<p style='color: var(--danger); padding:20px;'>Failed to load history.</p>`;
            return;
        }

        const history = await res.json();

        if (history.length === 0) {
            content.innerHTML = `<p style='padding:30px; text-align:center; color: var(--text-muted);'>No issuance history found for this asset.</p>`;
            return;
        }

        let html = `
            <div class="inventory-table-container">
                <table style="font-size: 12px;">
                    <thead>
                        <tr>
                            <th>Issue Date</th>
                            <th>Issued To</th>
                            <th>Emp No</th>
                            <th>Status</th>
                            <th>Submit Date</th>
                            <th>Duration</th>
                            <th>Reference No</th>
                            <th>Remarks</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${history.map(h => {
                            const duration = h.submitDate ? calculateDuration(h.issueDate, h.submitDate) : calculateDuration(h.issueDate, new Date()) + " (Ongoing)";
                            return `
                            <tr>
                                <td>${formatDate(h.issueDate)}</td>
                                <td>${h.issuedTo || '-'}</td>
                                <td>${h.empNo || '-'}</td>
                                <td><span class="status-badge ${h.status === 'Returned' ? 'status-available' : 'status-issued'}">${h.status}</span></td>
                                <td>${formatDate(h.submitDate)}</td>
                                <td style="font-weight: 500; color: var(--primary);">${duration}</td>
                                <td>${h.referenceFileNo || '-'}</td>
                                <td>${h.remarks || '-'}</td>
                            </tr>
                        `}).join("")}
                    </tbody>
                </table>
            </div>
        `;
        content.innerHTML = html;

    } catch (error) {
        console.error("History Error:", error);
        content.innerHTML = `<p style='color: var(--danger); padding:20px;'>Connectivity error.</p>`;
    }
}

function calculateDuration(start, end) {
    if (!start) return "-";
    const s = new Date(start);
    const e = new Date(end);
    if (isNaN(s) || isNaN(e)) return "-";
    
    const diffTime = Math.abs(e - s);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Less than 1 day";
    return `${diffDays} Day${diffDays > 1 ? 's' : ''}`;
}

function closeHistory() {
    const modal = document.getElementById("historyModal");
    modal.classList.add("hidden");
    modal.style.display = "none";
}

document.getElementById("status")?.addEventListener("change", function() {
    if (this.value === "Available") {
        document.getElementById("currentlyIssuedTo").value = "";
        document.getElementById("empNo_form").value = "";
        document.getElementById("issuedDate").value = "";
    }
});

console.log(" TCIL Inventory System Script Loaded Successfully");
