//========== DECLARATIONS ==========//
const INVOICE_FIELDS = [
  'roomName',
  'total',
  'debt',
  'roomUnitPrice',

  'oldElectricIndex',
  'newElectricIndex',
  'electricNumber',
  'electricUnitPrice',
  'electricFee',

  'oldWaterIndex',
  'newWaterIndex',
  'waterNumber',
  'waterUnitPricePerCube',
  'waterFeeByCube',

  'renterCount',
  'waterUnitPricePerCapita',
  'waterFeeByCapita',

  'motorbikeCount',
  'motorbikeUnitPrice',
  'motorbikeFee',

  'bicycleCount',
  'bicycleUnitPrice',
  'bicycleFee',

  'cleaningFee',
];
let selectFileInput = document.getElementById('js-invoice-select-input');
let createApartmentInput = document.getElementById('js-create-apartment-input');
let createApartmentButton = document.getElementById('js-create-apartment-button');
let enterCodeInput = document.getElementById('js-enter-code-input');
let enterCodeButton = document.getElementById('js-code-button');
let backupButton = document.getElementById('js-backup-button');
let capacityText = document.getElementById('js-capacity');
let apartmentTotalText = document.getElementById('js-apartment-total');
let apartmentList = document.getElementById('js-apartment-list');
let contactCard = document.getElementById('js-contact-card');
let apartmentNameText = document.getElementById('js-apartment-name');
let invoiceTable = document.getElementById('js-invoice-table');
let printInvoiceButton = document.getElementById('js-print-invoice-button');

let invoices = [];

//========== EVENT LISTENERS ==========//
document.addEventListener('DOMContentLoaded', _ => {
  renderApartmentList();

  let apartments = getApartmentsFromStorage();
  if (!apartments || apartments.length === 0) {
    selectFileInput.setAttribute('disabled', '');
  }

  // Set initial capacity
  let capacity = localStorage.getItem('capacity');
  if (!capacity) {
    localStorage.setItem('capacity', 5);
  }

  selectFileInput.value = '';
  createApartmentInput.value = '';
  enterCodeInput.value = '';
  enterCodeButton.setAttribute('disabled', '');
  createApartmentButton.setAttribute('disabled', '');
  printInvoiceButton.setAttribute('disabled', '');
  let selectedApartment = localStorage.getItem('apartment');
  if (selectedApartment) {
    apartmentNameText.textContent = 'Hóa đơn nhà trọ ' + selectedApartment;
  }
});

selectFileInput.addEventListener('change', async _ => {
  let file = selectFileInput.files[0];
  if (!file) return;
  let binary = await file.arrayBuffer();
  await loadInvoices(binary);
  renderInvoiceElements(invoices);
});

createApartmentInput.addEventListener('input', _ => {
  toggleNewApartmentButton();
});

createApartmentButton.addEventListener('click', _ => {
  let apartmentName = createApartmentInput.value?.trim();
  if (!apartmentName) {
    alert('Không thể để trống tên nhà trọ.');
    return;
  }

  let isDuplicated = Array.from(apartmentList.children).some(li => li.getAttribute('data-name').toLowerCase() === apartmentName.toLowerCase());
  if (isDuplicated) {
    alert('Tên nhà trọ đã bị trùng. Vui lòng chọn tên khác.');
    return;
  }

  let capacity = localStorage.getItem('capacity');
  let apartments = getApartmentsFromStorage();
  if (apartments.length >= capacity) {
    alert(`Bạn chỉ có thể tạo tối đa ${capacity} nhà trọ. Liên hệ hỗ trợ để lấy code.`);
    return;
  }

  setNewApartmentToStorage(apartmentName);

  if (!localStorage.getItem('apartment')) {
    localStorage.setItem('apartment', apartmentName);
  }

  renderApartmentList();

  createApartmentInput.value = '';
  createApartmentButton.setAttribute('disabled', '');
  selectFileInput.removeAttribute('disabled');
});

enterCodeInput.addEventListener('input', _ => {
  toggleCodeButton();
});

enterCodeButton.addEventListener('click', _ => {
  let code = enterCodeInput.value?.trim();
  if (!code) return;

  let isSuccessful = enterCode(code);
  if (isSuccessful) {
    enterCodeInput.value = '';
    enterCodeButton.setAttribute('disabled', '');
  }
});

backupButton.addEventListener('click', _ => {
  let data = JSON.parse(JSON.stringify(localStorage));
  data = {
    apartment: '',
    capacity: 5,
    ...data,
    apartments: data.apartments ? JSON.parse(data.apartments) : [],
  };

  // Backup content
  let file = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });

  // Prepare download URL
  let href = URL.createObjectURL(file);

  // Create a link
  let link = document.createElement('a');
  link.setAttribute('href', href);
  link.setAttribute('download', 'du-lieu-nha-tro.' + new Date().toISOString().replaceAll('-', '').substring(0, 8) + '.json');
  link.setAttribute('type', 'application/json');

  // Initialize download process
  link.click();

  // Clean up
  URL.revokeObjectURL(href);
});

apartmentList.addEventListener('click', event => {
  if (event.target.nodeName !== 'BUTTON') return;

  let apartmentName = event.target.getAttribute('data-name');

  if (event.target.classList.contains('js-apartment-select')) {
    localStorage.setItem('apartment', apartmentName);
    apartmentNameText.textContent = 'Hóa đơn nhà trọ ' + apartmentName;
    renderSelectedApartment();
  }

  if (event.target.classList.contains('js-apartment-removal')) {
    let removingApartment = apartmentName;

    let apartments = getApartmentsFromStorage();
    let index = apartments.indexOf(removingApartment);
    apartments.splice(index, 1);
    localStorage.setItem('apartments', JSON.stringify(apartments));

    if (apartments.length === 0) {
      localStorage.setItem('apartment', '');
      printInvoiceButton.setAttribute('disabled', '');
      selectFileInput.setAttribute('disabled', '');
      invoiceTable.innerHTML = '';
      apartmentNameText.textContent = 'Chưa tạo nhà trọ';
    } else {
      let selectedApartment = localStorage.getItem('apartment');
      if (!apartments.includes(selectedApartment)) {
        localStorage.setItem('apartment', apartments[0]);
        apartmentNameText.textContent = 'Hóa đơn nhà trọ ' + apartments[0];
      }
    }

    renderApartmentList();
  }
});

printInvoiceButton.addEventListener('click', async _ => {
  let selectedCheckboxes = document.querySelectorAll('input[type="checkbox"]:checked');
  if (selectedCheckboxes.length === 0) return;

  let selectedInvoices = [];
  for (let checkbox of selectedCheckboxes) {
    let index = checkbox.getAttribute('data-id');
    selectedInvoices.push(invoices[index]);
  }

  let printTemplate = await getTemplate('print.html');
  let invoiceTemplate = await getTemplate('invoice.html');

  let htmlCollection = [];
  for (let i = 0; i < selectedInvoices.length; i++) {
    let html = renderInvoiceHtml(selectedInvoices[i], invoiceTemplate);
    htmlCollection.push(html);

    if (i % 2 === 1 && i < selectedInvoices.length - 1) {
      htmlCollection.push('<div class="page-break"></div>');
    }
  }

  let printHtml = printTemplate.replace('<main></main>', htmlCollection.join(''));

  let tab = window.open('', '_blank');
  tab.document.write(printHtml);
});

//========== INVOICES ==========//
function getCellValue(row, column) {
  let cell = row.getCell(column);
  return cell.text || cell.result || cell.value;
}

function parseNumber(value) {
  let numericValue = parseInt(value);
  if (!numericValue || numericValue === 0) return null;
  return formatNumber(numericValue.toString(), ',');
}

function parseRow(row) {
  let invoice = {
    roomName: getCellValue(row, 'A'),
    roomUnitPrice: parseNumber(getCellValue(row, 'B')),

    oldElectricIndex: parseNumber(getCellValue(row, 'M')),
    newElectricIndex: parseNumber(getCellValue(row, 'N')),
    electricNumber: parseNumber(getCellValue(row, 'O')),
    electricUnitPrice: parseNumber(getCellValue(row, 'P')),
    electricFee: parseNumber(getCellValue(row, 'C')),

    oldWaterIndex: parseNumber(getCellValue(row, 'S')),
    newWaterIndex: parseNumber(getCellValue(row, 'T')),
    waterNumber: parseNumber(getCellValue(row, 'U')),
    waterUnitPricePerCube: parseNumber(getCellValue(row, 'V')),
    waterFeeByCube: parseNumber(getCellValue(row, 'D')),

    renterCount: parseNumber(getCellValue(row, 'Q')),
    waterUnitPricePerCapita: parseNumber(getCellValue(row, 'R')),
    waterFeeByCapita: parseNumber(getCellValue(row, 'E')),

    motorbikeCount: parseNumber(getCellValue(row, 'Y')),
    motorbikeUnitPrice: parseNumber(getCellValue(row, 'Z')),
    motorbikeFee: null,

    bicycleCount: parseNumber(getCellValue(row, 'W')),
    bicycleUnitPrice: parseNumber(getCellValue(row, 'X')),
    bicycleFee: null,

    cleaningFee: parseNumber(getCellValue(row, 'G')),
    debt: parseNumber(getCellValue(row, 'H')),
    total: parseNumber(getCellValue(row, 'K')),
  };

  invoice.motorbikeFee = parseNumber(invoice.motorbikeCount * parseInt(invoice.motorbikeUnitPrice.replaceAll(',', '')));
  invoice.bicycleFee = parseNumber(invoice.bicycleCount * parseInt(invoice.bicycleUnitPrice.replaceAll(',', '')));

  return invoice;
}

function formatNumber(value, separator) {
  value = typeof value !== 'undefined' && value > 0 ? value : '';
  value = value.replace(new RegExp('^(\\d{' + (value.length % 3 ? value.length % 3 : 0) + '})(\\d{3})', 'g'), "$1 $2").replace(/(\d{3})+?/gi, "$1 ").trim();
  if (typeof separator !== 'undefined' && separator != " ") {
    value = value.replace(/\s/g, separator);
  }
  return value;
}

async function loadInvoices(excelBinary) {
  let workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(excelBinary);
  let worksheet = workbook.worksheets[0];

  // Remove all previous items
  invoices = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    if (!getCellValue(row, 'A')) return;

    let invoice = parseRow(row);
    invoices.push(invoice);
  });
}

function renderInvoiceElements(invoices) {
  invoiceTable.innerHTML = '';

  invoices.forEach((invoice, index) => {
    let row = invoiceTable.insertRow();
    row.classList.add('even:bg-slate-400');
    row.classList.add('hover:bg-slate-700');
    row.classList.add('hover:text-white');

    let cell = row.insertCell();
    cell.classList.add('border-solid');
    cell.classList.add('border-x-2');
    cell.classList.add('border-white');
    cell.classList.add('text-center');

    let input = document.createElement('input');
    input.setAttribute('type', 'checkbox');
    input.setAttribute('data-id', index);
    input.addEventListener('change', togglePrintButton);
    cell.appendChild(input);

    for (let key of INVOICE_FIELDS) {
      let cell = row.insertCell();
      cell.innerText = invoice[key];
      cell.classList.add('border-x-2');
      cell.classList.add('border-solid');
      cell.classList.add('border-white');
      if (key === 'roomName') {
        cell.classList.add('text-left');
      }
    }
  });
}

//========== APARTMENTS ==========//
function getApartmentsFromStorage() {
  let cacheValue = localStorage.getItem('apartments');
  if (!cacheValue) return [];
  let apartments = JSON.parse(cacheValue);
  return apartments;
}

function renderApartmentList() {
  let apartments = getApartmentsFromStorage();

  // Remove all items
  apartmentList.innerHTML = '';

  // Re-insert items to list
  for (let apartment of apartments) {
    renderApartmentElement(apartment);
  }

  let selectedApartment = localStorage.getItem('apartment');
  renderSelectedApartment(selectedApartment);

  let capacity = localStorage.getItem('capacity') || 5;
  apartmentTotalText.textContent = apartments.length;
  capacityText.textContent = capacity;
}

function renderApartmentElement(apartment) {
  let item = document.createElement('li');

  item.setAttribute('data-name', apartment);
  item.classList.add('px-2');
  item.classList.add('hover:bg-slate-700');
  item.classList.add('hover:text-white');
  item.classList.add('mt-1');

  let selectButton = document.createElement('button');
  selectButton.classList.add('js-apartment-select');
  selectButton.classList.add('float-left');
  selectButton.classList.add('mt-1');
  selectButton.classList.add('text-xs');
  selectButton.setAttribute('type', 'button');
  selectButton.setAttribute('data-name', apartment);
  selectButton.textContent = 'Chọn';
  item.appendChild(selectButton);

  item.append(apartment);

  let removeButton = document.createElement('button');
  removeButton.classList.add('js-apartment-removal');
  removeButton.classList.add('float-right');
  removeButton.classList.add('mt-1');
  removeButton.classList.add('text-xs');
  removeButton.setAttribute('type', 'button');
  removeButton.setAttribute('data-name', apartment);
  removeButton.textContent = 'Xóa';
  item.appendChild(removeButton);

  //item.innerHTML = `<button class="js-apartment-select float-left text-xs" type="button" data-name="${apartment}">Chọn</button>${apartment}<button class="js-apartment-removal float-right text-xs" type="button" data-name="${apartment}">Xóa</button>`;

  apartmentList.appendChild(item);
}

function toggleNewApartmentButton() {
  if (!createApartmentInput.value?.trim()) {
    createApartmentButton.setAttribute('disabled', '');
  } else {
    createApartmentButton.removeAttribute('disabled');
  }
}

function setNewApartmentToStorage(apartment) {
  let apartments = getApartmentsFromStorage();
  apartments.push(apartment);
  apartments.sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
  localStorage.setItem('apartments', JSON.stringify(apartments));
}

function renderSelectedApartment() {
  for (let item of apartmentList.children) {
    item.classList.remove('bg-slate-400');
  }
  let apartment = localStorage.getItem('apartment');
  let selectedItem = Array.from(apartmentList.children).find(li => li.getAttribute('data-name') === apartment);
  if (selectedItem) {
    selectedItem.classList.add('bg-slate-400');
  }
}

//========== CODE ==========//
function toggleCodeButton() {
  if (!enterCodeInput.value?.trim()) {
    enterCodeButton.setAttribute('disabled', '');
  } else {
    enterCodeButton.removeAttribute('disabled');
  }
}

function enterCode(code) {
  try {
    let decodedString = atob(code);
    let decodedObject = JSON.parse(decodedString);
    if (!decodedObject.date || !decodedObject.capacity) {
      alert('Bạn đã nhập sai code. Liên hệ hỗ trợ để lấy code.');
      return;
    }

    if (!new Date().toISOString().startsWith(decodedObject.date)) {
      alert('Bạn đã nhập sai code. Liên hệ hỗ trợ để lấy code.');
      return;
    }

    let capacity = parseInt(localStorage.getItem('capacity')) || 5;
    if (decodedObject.capacity < capacity) {
      alert('Bạn đã nhập sai code. Liên hệ hỗ trợ để lấy code.');
      return;
    }

    localStorage.setItem('capacity', decodedObject.capacity);

    alert(`Nhập code thành công! Hiện tại bạn có thể tạo tối đa ${decodedObject.capacity} nhà trọ.`);
    return true;
  } catch {
    alert('Bạn đã nhập sai code. Liên hệ hỗ trợ để lấy code.');
  }

  return false;
}

//========== BACKUP/RESTORE ==========//
function restore(data) {
  // Sort apartments alphabetically
  let apartments = data.apartments;
  apartments.sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));

  localStorage.setItem('apartments', JSON.stringify(apartments));
  localStorage.setItem('apartment', apartments[0]);
  localStorage.setItem('capacity', data.capacity);
}

//========== PRINTING ==========//
async function getTemplate(url) {
  return await new Promise(resolve => {
    let printTemplateRequest = new XMLHttpRequest();
    printTemplateRequest.onreadystatechange = function () {
      if (printTemplateRequest.readyState !== 4) return;
      resolve(printTemplateRequest.responseText);
    };
    printTemplateRequest.open('GET', url);
    printTemplateRequest.send(null);
  });
}

function renderInvoiceHtml(invoice, template) {
  let apartment = localStorage.getItem('apartment');
  return template
    .replaceAll('@apartment', apartment)
    .replaceAll('@roomName', invoice.roomName)
    .replaceAll('@roomUnitPrice', invoice.roomUnitPrice || 0)
    .replaceAll('@oldElectricIndex', invoice.oldElectricIndex || 0)
    .replaceAll('@newElectricIndex', invoice.newElectricIndex || 0)
    .replaceAll('@electricNumber', invoice.electricNumber || 0)
    .replaceAll('@electricUnitPrice', invoice.electricUnitPrice || 0)
    .replaceAll('@electricFee', invoice.electricFee || 0)
    .replaceAll('@oldWaterIndex', invoice.oldWaterIndex || 0)
    .replaceAll('@newWaterIndex', invoice.newWaterIndex || 0)
    .replaceAll('@waterNumber', invoice.waterNumber || 0)
    .replaceAll('@waterUnitPricePerCube', invoice.waterUnitPricePerCube || 0)
    .replaceAll('@waterFeeByCube', invoice.waterFeeByCube || 0)
    .replaceAll('@renterCount', invoice.renterCount || 0)
    .replaceAll('@waterUnitPricePerCapita', invoice.waterUnitPricePerCapita || 0)
    .replaceAll('@waterFeeByCapita', invoice.waterFeeByCapita || 0)
    .replaceAll('@motorbikeCount', invoice.motorbikeCount || 0)
    .replaceAll('@motorbikeUnitPrice', invoice.motorbikeUnitPrice || 0)
    .replaceAll('@motorbikeFee', invoice.motorbikeFee || 0)
    .replaceAll('@bicycleCount', invoice.bicycleCount || 0)
    .replaceAll('@bicycleUnitPrice', invoice.bicycleUnitPrice || 0)
    .replaceAll('@bicycleFee', invoice.bicycleFee || 0)
    .replaceAll('@cleaningFee', invoice.cleaningFee || 0)
    .replaceAll('@debt', invoice.debt || 0)
    .replaceAll('@total', invoice.total || 0)
    .replaceAll('@printDate', new Date().toISOString().substring(0, 10));
}

function chunkMaxLength(array, chunkSize, maxLength) {
  return Array.from({ length: maxLength }, () => array.splice(0, chunkSize));
}

function togglePrintButton() {
  let hasSelection = invoiceTable.querySelectorAll('input[type="checkbox"]:checked').length > 0;
  if (hasSelection) {
    printInvoiceButton.removeAttribute('disabled', '');
  } else {
    printInvoiceButton.setAttribute('disabled', '');
  }
}

//========== DEBUGGING ==========//
function init(fileName) {
  let dataRequest = new XMLHttpRequest();
  dataRequest.onreadystatechange = function () {
    if (dataRequest.readyState !== 4) return;

    // Load apartments from JSON
    let data = JSON.parse(dataRequest.responseText);

    // Sort apartments alphabetically
    let apartments = data.apartments;
    apartments.sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));

    localStorage.setItem('apartments', JSON.stringify(apartments));
    localStorage.setItem('apartment', apartments[0]);
    localStorage.setItem('capacity', data.capacity);
  };
  dataRequest.open('GET', fileName + '.json');
  dataRequest.send(null);
}

function generateCapacityCode(capacity) {
  let date = new Date().toISOString().substring(0, 10);
  let decodedObject = {
    date: date,
    capacity: capacity,
  };
  return btoa(JSON.stringify(decodedObject));
}