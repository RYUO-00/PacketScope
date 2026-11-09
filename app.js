/* 1) CONFIGURATION AND COLOURS */

// These colours keep every chart in the same visual style as the dashboard.
var CHART_COLOURS = ["#00e5ff", "#8b5cf6", "#ff2d95", "#39ff14", "#f6ba50", "#4991ff", "#ff765e", "#54d6ad"];

// This lookup gives each common capture protocol a friendly network-layer name.
var PROTOCOL_LAYERS = {
  "ARP": "Link / Network access",
  "ICMP": "Network / Internet",
  "ICMPv6": "Network / Internet",
  "IP": "Network / Internet",
  "IPv6": "Network / Internet",
  "TCP": "Transport",
  "UDP": "Transport",
  "QUIC": "Transport (over UDP)",
  "DNS": "Application",
  "HTTP": "Application",
  "HTTPS": "Application",
  "TLS": "Application",
  "TLSv1.2": "Application",
  "TLSv1.3": "Application",
  "DHCP": "Application",
  "NTP": "Application",
  "SSH": "Application",
  "FTP": "Application",
  "SMTP": "Application",
  "MDNS": "Application"
};

// This shared state keeps the current capture and chart instances available to the page.
var appState = {
  packets: [],
  statistics: null,
  charts: {},
  fileName: "",
  dataReady: false
};

// This small CSV sample lets the dashboard still demonstrate itself when opened directly as a local file.
var LOCAL_DEMO_CSV = "frame.number,frame.time_relative,ip.src,ip.dst,_ws.col.Protocol,frame.len,tcp.srcport,tcp.dstport\n" +
  "1,0.08,192.168.1.10,8.8.8.8,DNS,78,,\n" +
  "2,0.21,8.8.8.8,192.168.1.10,DNS,126,,\n" +
  "3,0.43,192.168.1.10,142.250.72.14,TLSv1.3,1420,53002,443\n" +
  "4,0.61,142.250.72.14,192.168.1.10,TLSv1.3,1184,443,53002\n" +
  "5,1.03,192.168.1.11,104.16.132.229,HTTP,512,53003,80\n" +
  "6,1.36,192.168.1.10,1.1.1.1,ICMP,98,,\n" +
  "7,2.17,,,ARP,60,,\n" +
  "8,2.72,192.168.1.12,1.1.1.1,UDP,240,,\n" +
  "9,3.14,192.168.1.10,142.250.72.14,TLSv1.3,1380,53002,443\n" +
  "10,3.89,192.168.1.11,8.8.8.8,DNS,84,,\n" +
  "11,4.06,8.8.8.8,192.168.1.11,DNS,132,,\n" +
  "12,5.22,192.168.1.13,104.16.132.229,QUIC,1320,,\n" +
  "13,6.41,192.168.1.10,142.250.72.14,TLSv1.3,1450,53002,443\n" +
  "14,7.19,192.168.1.14,192.168.1.1,ICMP,92,,\n" +
  "15,8.30,192.168.1.12,104.16.132.229,TCP,980,53007,443\n" +
  "16,9.74,192.168.1.10,142.250.72.14,TLSv1.3,1420,53002,443\n" +
  "17,10.52,192.168.1.11,192.168.1.1,ARP,60,,\n" +
  "18,11.67,192.168.1.13,8.8.8.8,DNS,76,,\n" +
  "19,12.22,192.168.1.10,142.250.72.14,TLSv1.3,1460,53002,443\n" +
  "20,14.03,192.168.1.10,142.250.72.14,TLSv1.3,1460,53002,443\n" +
  "21,14.08,192.168.1.11,104.16.132.229,QUIC,1320,,\n" +
  "22,14.12,,,ARP,60,,\n" +
  "23,14.28,192.168.1.12,1.1.1.1,ICMP,98,,\n" +
  "24,14.73,192.168.1.13,142.250.72.14,TLSv1.3,1380,53009,443\n" +
  "25,15.33,192.168.1.14,8.8.8.8,DNS,84,,\n" +
  "26,16.04,192.168.1.10,104.16.132.229,HTTP,740,53011,80\n" +
  "27,17.21,192.168.1.12,142.250.72.14,TLSv1.3,1410,53012,443\n" +
  "28,18.44,192.168.1.11,1.1.1.1,ICMP,94,,\n" +
  "29,19.85,192.168.1.13,104.16.132.229,UDP,320,,\n" +
  "30,20.66,192.168.1.10,142.250.72.14,TLSv1.3,1440,53002,443\n" +
  "31,21.70,,,ARP,60,,\n" +
  "32,22.92,192.168.1.14,104.16.132.229,QUIC,1270,,\n" +
  "33,24.14,192.168.1.12,8.8.8.8,DNS,80,,\n" +
  "34,25.61,192.168.1.10,142.250.72.14,TLSv1.3,1390,53002,443\n" +
  "35,27.83,192.168.1.11,104.16.132.229,HTTP,680,53016,80\n" +
  "36,29.91,192.168.1.13,1.1.1.1,ICMP,88,,\n";

/* 2) FILE LOADING AND CSV PARSING */

// This helper converts numeric CSV fields safely and returns null for blank or invalid values.
function readNumber(value) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }

  var numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return null;
  }
  return numberValue;
}

// This function removes accidental spaces from CSV header names before PapaParse uses them.
function cleanHeader(header) {
  return String(header).trim();
}

// This function starts parsing CSV text and keeps parsing separate from the display code.
function parseCsvText(csvText, fileName) {
  if (typeof Papa === "undefined") {
    showMessage("PapaParse could not load. Check your internet connection and reload the page.", "error");
    return;
  }

  appState.fileName = fileName;
  showMessage("Reading " + fileName + "…", "");
  Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: cleanHeader,
    complete: handleParsedCsv,
    error: handleParseError
  });
}

// This function converts parsed CSV rows into a clean packet list and refreshes the dashboard.
function handleParsedCsv(result) {
  var packets = [];
  var rows = result.data;
  var rowIndex;

  for (rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    var row = rows[rowIndex];
    var frameNumber = readNumber(row["frame.number"]);
    var time = readNumber(row["frame.time_relative"]);
    var length = readNumber(row["frame.len"]);
    var source = String(row["ip.src"] || row["ipv6.src"] || "").trim();
    var destination = String(row["ip.dst"] || row["ipv6.dst"] || "").trim();
    var protocol = String(row["_ws.col.Protocol"] || row.Protocol || "").trim();
    var sourcePort = readNumber(row["tcp.srcport"]);
    var destinationPort = readNumber(row["tcp.dstport"]);
    var hasTextData = source !== "" || destination !== "" || protocol !== "" || sourcePort !== null || destinationPort !== null;

    if (frameNumber === null && time === null && length === null && !hasTextData) {
      continue;
    }

    packets.push({
      frameNumber: frameNumber === null ? packets.length + 1 : frameNumber,
      time: time,
      source: source === "" ? "N/A" : source,
      destination: destination === "" ? "N/A" : destination,
      protocol: protocol === "" ? "UNKNOWN" : protocol,
      length: length,
      sourcePort: sourcePort,
      destinationPort: destinationPort
    });
  }

  if (packets.length === 0) {
    showMessage("No valid packet rows were found. Check the CSV header and contents.", "error");
    return;
  }

  appState.packets = packets;
  appState.statistics = calculateStatistics(packets);
  appState.dataReady = true;
  renderDashboard();
  showMessage("Loaded " + packets.length.toLocaleString() + " packets from " + appState.fileName + ".", "success");
}

// This function reports parsing errors in the upload area so students can diagnose a bad file.
function handleParseError(error) {
  var message = error && error.message ? error.message : "The CSV could not be read.";
  showMessage("Could not parse CSV: " + message, "error");
}

// This function reads a chosen local CSV file and hands its text to the parser.
function handleFileSelection(event) {
  var file = event.target.files && event.target.files[0];
  if (!file) {
    return;
  }

  var reader = new FileReader();
  appState.fileName = file.name;
  reader.onload = handleFileRead;
  reader.onerror = handleFileReadError;
  reader.readAsText(file);
  event.target.value = "";
}

// This function parses the text after a selected file has finished loading.
function handleFileRead(event) {
  parseCsvText(event.target.result, appState.fileName);
}

// This function shows a clear message if the browser cannot read the selected file.
function handleFileReadError() {
  showMessage("The selected file could not be read. Try choosing it again.", "error");
}

// This function loads sample.csv when served over HTTP and uses a small built-in sample on file:// pages.
function loadDemoData() {
  showMessage("Loading the demo capture…", "");
  fetch("sample.csv")
    .then(handleDemoResponse)
    .catch(handleDemoLoadError);
}

// This function checks the demo response and passes its CSV contents to the normal parser.
function handleDemoResponse(response) {
  if (!response.ok) {
    throw new Error("sample.csv could not be fetched");
  }
  return response.text().then(handleDemoText);
}

// This function parses the fetched sample.csv using the same code as an uploaded file.
function handleDemoText(csvText) {
  parseCsvText(csvText, "sample.csv");
}

// This function keeps the demo button useful when a browser blocks local-file fetch requests.
function handleDemoLoadError() {
  if (window.location.protocol === "file:") {
    parseCsvText(LOCAL_DEMO_CSV, "built-in demo (local file mode)");
    showMessage("Loaded the built-in demo. Use python -m http.server to load all of sample.csv.", "success");
    return;
  }
  showMessage("Could not load sample.csv. Run python -m http.server in the packetscope folder and try again.", "error");
}

// This function sets the drop zone message and applies a matching visual status.
function showMessage(message, kind) {
  var messageElement = document.getElementById("uploadMessage");
  messageElement.textContent = message;
  messageElement.className = "upload-message";
  if (kind) {
    messageElement.classList.add(kind);
  }
}

/* 3) STATISTICS CALCULATION */

// This function counts protocols, IPs, seconds, source talkers, and packet-size buckets.
function calculateStatistics(packets) {
  var protocolCounts = {};
  var sourceCounts = {};
  var ipSeen = {};
  var secondCounts = {};
  var sizeBuckets = { "0–100": 0, "101–500": 0, "501–1000": 0, "1001–1500": 0, "1501+": 0 };
  var totalBytes = 0;
  var validLengthCount = 0;
  var minimumTime = null;
  var maximumTime = null;
  var index;

  for (index = 0; index < packets.length; index += 1) {
    var packet = packets[index];
    protocolCounts[packet.protocol] = (protocolCounts[packet.protocol] || 0) + 1;

    if (packet.source !== "N/A") {
      sourceCounts[packet.source] = (sourceCounts[packet.source] || 0) + 1;
      ipSeen[packet.source] = true;
    }
    if (packet.destination !== "N/A") {
      ipSeen[packet.destination] = true;
    }

    if (packet.time !== null) {
      var second = Math.floor(packet.time);
      secondCounts[second] = (secondCounts[second] || 0) + 1;
      if (minimumTime === null || packet.time < minimumTime) {
        minimumTime = packet.time;
      }
      if (maximumTime === null || packet.time > maximumTime) {
        maximumTime = packet.time;
      }
    }

    if (packet.length !== null && packet.length >= 0) {
      totalBytes += packet.length;
      validLengthCount += 1;
      if (packet.length <= 100) {
        sizeBuckets["0–100"] += 1;
      } else if (packet.length <= 500) {
        sizeBuckets["101–500"] += 1;
      } else if (packet.length <= 1000) {
        sizeBuckets["501–1000"] += 1;
      } else if (packet.length <= 1500) {
        sizeBuckets["1001–1500"] += 1;
      } else {
        sizeBuckets["1501+"] += 1;
      }
    }
  }

  var protocolList = sortCountEntries(protocolCounts);
  var talkerList = sortCountEntries(sourceCounts).slice(0, 5);
  var timeList = sortNumericEntries(secondCounts);
  var busiestSecond = { second: null, count: 0 };
  for (index = 0; index < timeList.length; index += 1) {
    if (timeList[index].count > busiestSecond.count) {
      busiestSecond = timeList[index];
    }
  }

  return {
    packetCount: packets.length,
    totalBytes: totalBytes,
    averageSize: validLengthCount === 0 ? 0 : totalBytes / validLengthCount,
    duration: minimumTime === null ? 0 : maximumTime - minimumTime,
    uniqueIpCount: Object.keys(ipSeen).length,
    protocolList: protocolList,
    sourceTalkers: talkerList,
    secondList: timeList,
    busiestSecond: busiestSecond,
    sizeBuckets: sizeBuckets
  };
}

// This function changes a count object into a descending list for charts and tables.
function sortCountEntries(countObject) {
  var entries = [];
  var key;
  for (key in countObject) {
    if (Object.prototype.hasOwnProperty.call(countObject, key)) {
      entries.push({ name: key, count: countObject[key] });
    }
  }
  entries.sort(compareCountEntries);
  return entries;
}

// This function puts larger counts before smaller counts and sorts ties by name.
function compareCountEntries(first, second) {
  if (second.count !== first.count) {
    return second.count - first.count;
  }
  return first.name.localeCompare(second.name);
}

// This function sorts time buckets from the earliest second to the latest second.
function sortNumericEntries(countObject) {
  var entries = [];
  var key;
  for (key in countObject) {
    if (Object.prototype.hasOwnProperty.call(countObject, key)) {
      entries.push({ second: Number(key), count: countObject[key] });
    }
  }
  entries.sort(compareSeconds);
  return entries;
}

// This function compares two whole-second values so the timeline reads left to right.
function compareSeconds(first, second) {
  return first.second - second.second;
}

/* 4) CHART DRAWING */

// This function clears old charts before drawing results for a newly loaded capture.
function destroyCharts() {
  var chartName;
  for (chartName in appState.charts) {
    if (Object.prototype.hasOwnProperty.call(appState.charts, chartName)) {
      appState.charts[chartName].destroy();
    }
  }
  appState.charts = {};
}

// This function gives Chart.js the shared grid, tick, and tooltip styling used by all plots.
function makeChartOptions(axisLabel) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 750, easing: "easeOutQuart" },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "rgba(8, 13, 25, 0.96)",
        borderColor: "rgba(0, 229, 255, 0.35)",
        borderWidth: 1,
        titleColor: "#edf4ff",
        bodyColor: "#b5c2d8",
        padding: 10,
        displayColors: true
      }
    },
    scales: {
      x: {
        grid: { color: "rgba(139, 157, 190, 0.08)", drawBorder: false },
        border: { display: false },
        ticks: { color: "#78869f", font: { family: "Inter", size: 9 }, maxRotation: 0, autoSkip: true },
        title: { display: Boolean(axisLabel), text: axisLabel || "", color: "#78869f", font: { family: "Inter", size: 9 } }
      },
      y: {
        beginAtZero: true,
        grid: { color: "rgba(139, 157, 190, 0.09)", drawBorder: false },
        border: { display: false },
        ticks: { color: "#78869f", precision: 0, font: { family: "Inter", size: 9 } }
      }
    }
  };
}

// This function creates the four charts from the already calculated statistics.
function drawCharts(statistics) {
  if (typeof Chart === "undefined") {
    showMessage("Chart.js could not load. Check your internet connection and reload the page.", "error");
    return;
  }

  destroyCharts();
  drawProtocolChart(statistics);
  drawTrafficChart(statistics);
  drawTalkersChart(statistics);
  drawSizeChart(statistics);
}

// This function draws the doughnut chart with one slice for each protocol.
function drawProtocolChart(statistics) {
  var labels = [];
  var values = [];
  var index;
  for (index = 0; index < statistics.protocolList.length; index += 1) {
    labels.push(statistics.protocolList[index].name);
    values.push(statistics.protocolList[index].count);
  }

  var options = makeChartOptions("");
  options.cutout = "68%";
  options.scales = {};
  options.plugins.legend = { display: true, position: "bottom", labels: { color: "#9ba9c0", boxWidth: 7, boxHeight: 7, padding: 12, usePointStyle: true, pointStyle: "circle", font: { family: "Inter", size: 9 } } };
  options.plugins.tooltip.callbacks = { label: makeDoughnutTooltip };
  appState.charts.protocol = new Chart(document.getElementById("protocolChart"), {
    type: "doughnut",
    data: { labels: labels, datasets: [{ data: values, backgroundColor: makeColours(values.length), borderColor: "#101728", borderWidth: 3, hoverOffset: 5 }] },
    options: options
  });
}

// This function formats each doughnut tooltip as a protocol name and packet count.
function makeDoughnutTooltip(context) {
  return " " + context.label + ": " + context.raw + " packets";
}

// This function draws the traffic timeline and includes quiet seconds with zero packets.
function drawTrafficChart(statistics) {
  var labels = [];
  var values = [];
  var secondCounts = {};
  var firstSecond = null;
  var lastSecond = null;
  var index;

  for (index = 0; index < statistics.secondList.length; index += 1) {
    var entry = statistics.secondList[index];
    secondCounts[entry.second] = entry.count;
    if (index === 0) {
      firstSecond = entry.second;
    }
    lastSecond = entry.second;
  }

  if (firstSecond !== null) {
    var second;
    for (second = firstSecond; second <= lastSecond; second += 1) {
      labels.push(String(second));
      values.push(secondCounts[second] || 0);
    }
  }

  var options = makeChartOptions("Second");
  options.scales.y.title = { display: true, text: "Packets", color: "#78869f", font: { family: "Inter", size: 9 } };
  appState.charts.traffic = new Chart(document.getElementById("trafficChart"), {
    type: "line",
    data: { labels: labels, datasets: [{ label: "Packets", data: values, borderColor: "#00e5ff", backgroundColor: "rgba(0, 229, 255, 0.1)", pointBackgroundColor: "#00e5ff", pointBorderColor: "#0a0e1a", pointBorderWidth: 2, pointRadius: values.length > 70 ? 0 : 2.5, pointHoverRadius: 5, borderWidth: 2, fill: true, tension: 0.32 }] },
    options: options
  });
}

// This function draws a horizontal bar chart for the five most common source IPs.
function drawTalkersChart(statistics) {
  var labels = [];
  var values = [];
  var index;
  for (index = 0; index < statistics.sourceTalkers.length; index += 1) {
    labels.push(statistics.sourceTalkers[index].name);
    values.push(statistics.sourceTalkers[index].count);
  }

  var options = makeChartOptions("Packets");
  options.indexAxis = "y";
  options.scales.x.title = { display: true, text: "Packets", color: "#78869f", font: { family: "Inter", size: 9 } };
  options.scales.y.ticks = { color: "#9ba9c0", font: { family: "Consolas", size: 9 } };
  appState.charts.talkers = new Chart(document.getElementById("talkersChart"), {
    type: "bar",
    data: { labels: labels, datasets: [{ label: "Packets", data: values, backgroundColor: makeColours(values.length), borderRadius: 4, borderSkipped: false, barThickness: 15 }] },
    options: options
  });
}

// This function draws packet counts in the requested byte ranges plus an overflow bucket.
function drawSizeChart(statistics) {
  var labels = Object.keys(statistics.sizeBuckets);
  var values = [];
  var index;

  if (statistics.sizeBuckets["1501+"] === 0) {
    labels.pop();
  }
  for (index = 0; index < labels.length; index += 1) {
    values.push(statistics.sizeBuckets[labels[index]]);
  }

  var options = makeChartOptions("Packet size (bytes)");
  options.scales.y.title = { display: true, text: "Packets", color: "#78869f", font: { family: "Inter", size: 9 } };
  appState.charts.sizes = new Chart(document.getElementById("sizeChart"), {
    type: "bar",
    data: { labels: labels, datasets: [{ label: "Packets", data: values, backgroundColor: ["rgba(0,229,255,.62)", "rgba(139,92,246,.68)", "rgba(255,45,149,.67)", "rgba(57,255,20,.56)", "rgba(246,186,80,.62)"], borderRadius: 5, borderSkipped: false, barThickness: 24 }] },
    options: options
  });
}

// This function repeats the neon colour list when a capture has more protocols than colours.
function makeColours(count) {
  var colours = [];
  var index;
  for (index = 0; index < count; index += 1) {
    colours.push(CHART_COLOURS[index % CHART_COLOURS.length]);
  }
  return colours;
}

/* 5) TABLE, INSIGHTS, AND DASHBOARD DISPLAY */

// This function updates every dashboard area after statistics are ready.
function renderDashboard() {
  var statistics = appState.statistics;
  document.getElementById("emptyState").classList.add("hidden");
  document.getElementById("dashboard").classList.remove("hidden");
  document.getElementById("sessionName").textContent = appState.fileName;
  document.getElementById("readyLabel").textContent = "Ready";
  document.getElementById("lastUpdated").textContent = "" + new Date().toLocaleTimeString();
  updateKpis(statistics);
  drawCharts(statistics);
  renderLayerTable(statistics);
  renderInsights(statistics);
  updateProtocolFilter(statistics);
  renderPacketTable();
}

// This function animates the numeric KPIs and fills in the text protocol card.
function updateKpis(statistics) {
  animateNumber(document.getElementById("totalPackets"), statistics.packetCount, 0, "");
  var kiloBytes = statistics.totalBytes / 1024;
  if (kiloBytes >= 1024) {
    animateNumber(document.getElementById("totalData"), kiloBytes / 1024, 2, " MB");
  } else {
    animateNumber(document.getElementById("totalData"), kiloBytes, 2, " KB");
  }
  animateNumber(document.getElementById("captureDuration"), statistics.duration, 2, " s");
  animateNumber(document.getElementById("uniqueIps"), statistics.uniqueIpCount, 0, "");
  animateNumber(document.getElementById("averageSize"), statistics.averageSize, 1, " B");

  var topProtocol = statistics.protocolList.length > 0 ? statistics.protocolList[0] : null;
  document.getElementById("topProtocol").textContent = topProtocol ? topProtocol.name : "—";
  if (topProtocol) {
    animateNumber(document.getElementById("topProtocolFoot"), topProtocol.count, 0, " packets observed");
  } else {
    document.getElementById("topProtocolFoot").textContent = "no protocols found";
  }
}

// This function counts a number upward briefly so the capture summary feels responsive.
function animateNumber(element, target, decimals, suffix) {
  var start = performance.now();
  var duration = 720;
  var startingValue = 0;

  // This nested callback updates one animation frame and stops at the target value.
  function updateNumber(now) {
    var progress = Math.min((now - start) / duration, 1);
    var easedProgress = 1 - Math.pow(1 - progress, 3);
    var current = startingValue + (target - startingValue) * easedProgress;
    element.textContent = current.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
    if (progress < 1) {
      requestAnimationFrame(updateNumber);
    }
  }

  requestAnimationFrame(updateNumber);
}

// This function shows the protocols present in the capture with their layer and count.
function renderLayerTable(statistics) {
  var body = document.getElementById("layerTableBody");
  body.textContent = "";

  var index;
  for (index = 0; index < statistics.protocolList.length; index += 1) {
    var entry = statistics.protocolList[index];
    var row = document.createElement("tr");
    var protocolCell = document.createElement("td");
    var layerCell = document.createElement("td");
    var countCell = document.createElement("td");
    var badge = document.createElement("span");

    badge.className = "protocol-badge " + getProtocolClass(entry.name);
    badge.textContent = entry.name;
    protocolCell.appendChild(badge);
    layerCell.textContent = findProtocolLayer(entry.name);
    countCell.textContent = entry.count.toLocaleString();
    countCell.className = "align-right";
    row.appendChild(protocolCell);
    row.appendChild(layerCell);
    row.appendChild(countCell);
    body.appendChild(row);
  }
}

// This function finds a layer in the lookup table and handles versioned protocol names.
function findProtocolLayer(protocol) {
  if (PROTOCOL_LAYERS[protocol]) {
    return PROTOCOL_LAYERS[protocol];
  }
  if (protocol.indexOf("TLS") === 0) {
    return "Application";
  }
  if (protocol.indexOf("DNS") === 0) {
    return "Application";
  }
  return "Other / Unclassified";
}

// This function creates safe badge classes and gives every TLS version the shared TLS colour.
function getProtocolClass(protocol) {
  var safeName = protocol.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
  if (safeName.indexOf("tls") === 0) {
    safeName = "tls";
  }
  return "protocol-" + safeName;
}

// This function writes three to five plain-English observations based on the capture.
function renderInsights(statistics) {
  var sentences = [];
  var total = statistics.packetCount;
  var tlsCount = 0;
  var icmpCount = 0;
  var httpCount = 0;
  var index;

  for (index = 0; index < statistics.protocolList.length; index += 1) {
    var protocolEntry = statistics.protocolList[index];
    if (protocolEntry.name.indexOf("TLS") === 0) {
      tlsCount += protocolEntry.count;
    }
    if (protocolEntry.name === "ICMP" || protocolEntry.name === "ICMPv6") {
      icmpCount += protocolEntry.count;
    }
    if (protocolEntry.name === "HTTP") {
      httpCount += protocolEntry.count;
    }
  }

  if (tlsCount > 0) {
    sentences.push("TLS made up " + Math.round((tlsCount / total) * 100) + "% of packets, suggesting that much of this application traffic is encrypted.");
  } else {
    sentences.push("No TLS packets were found, so this capture may contain little encrypted web traffic.");
  }

  if (statistics.busiestSecond.second !== null) {
    sentences.push("The busiest second was second " + statistics.busiestSecond.second + " with " + statistics.busiestSecond.count.toLocaleString() + " packets.");
  } else {
    sentences.push("No valid relative timestamps were available for a traffic timeline.");
  }

  if (icmpCount > 0) {
    sentences.push("ICMP packets were seen, which can indicate ping checks or traceroute activity.");
  } else {
    sentences.push("No ICMP packets were seen in this capture.");
  }

  if (statistics.protocolList.length > 0) {
    sentences.push(statistics.protocolList[0].name + " was the most common protocol with " + statistics.protocolList[0].count.toLocaleString() + " packets.");
  }

  if (httpCount > 0 && tlsCount === 0) {
    sentences.push("HTTP packets were present without TLS; HTTP content is not encrypted by the protocol itself.");
  }

  var list = document.getElementById("insightsList");
  list.textContent = "";
  for (index = 0; index < sentences.length; index += 1) {
    var item = document.createElement("div");
    var number = document.createElement("span");
    var text = document.createElement("span");
    item.className = "insight-item";
    number.className = "insight-number";
    number.textContent = String(index + 1).padStart(2, "0");
    text.textContent = sentences[index];
    item.appendChild(number);
    item.appendChild(text);
    list.appendChild(item);
  }
}

// This function creates the protocol filter choices from the current capture.
function updateProtocolFilter(statistics) {
  var select = document.getElementById("protocolFilter");
  select.textContent = "";
  var allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "All protocols";
  select.appendChild(allOption);

  var index;
  for (index = 0; index < statistics.protocolList.length; index += 1) {
    var option = document.createElement("option");
    option.value = statistics.protocolList[index].name;
    option.textContent = statistics.protocolList[index].name;
    select.appendChild(option);
  }
}

// This function filters and displays rows from the first 500 packets in the capture.
function renderPacketTable() {
  var body = document.getElementById("packetTableBody");
  var searchValue = document.getElementById("searchInput").value.trim().toLowerCase();
  var selectedProtocol = document.getElementById("protocolFilter").value;
  var visibleCount = 0;
  var shownRows = 0;
  var packetLimit = Math.min(appState.packets.length, 500);
  var index;

  body.textContent = "";
  for (index = 0; index < packetLimit; index += 1) {
    var packet = appState.packets[index];
    if (selectedProtocol !== "all" && packet.protocol !== selectedProtocol) {
      continue;
    }

    var searchableText = [packet.frameNumber, packet.time, packet.source, packet.destination, packet.protocol, packet.length, packet.sourcePort, packet.destinationPort].join(" ").toLowerCase();
    if (searchValue !== "" && searchableText.indexOf(searchValue) === -1) {
      continue;
    }

    visibleCount += 1;
    if (shownRows >= 500) {
      continue;
    }
    body.appendChild(makePacketRow(packet));
    shownRows += 1;
  }

  if (shownRows === 0) {
    var emptyRow = document.createElement("tr");
    var emptyCell = document.createElement("td");
    emptyCell.colSpan = 8;
    emptyCell.className = "empty-row";
    emptyCell.textContent = "No packets match this search and protocol filter.";
    emptyRow.appendChild(emptyCell);
    body.appendChild(emptyRow);
  }

  document.getElementById("packetCount").textContent = visibleCount.toLocaleString() + (visibleCount === 1 ? " packet" : " packets");
}

// This function makes one safely escaped table row for a packet.
function makePacketRow(packet) {
  var row = document.createElement("tr");
  var values = [
    { value: packet.frameNumber, className: "" },
    { value: packet.time === null ? "N/A" : packet.time.toFixed(6), className: "" },
    { value: packet.source, className: "ip-cell" },
    { value: packet.destination, className: "ip-cell" }
  ];
  var index;

  for (index = 0; index < values.length; index += 1) {
    var cell = document.createElement("td");
    cell.textContent = String(values[index].value);
    if (values[index].className) {
      cell.className = values[index].className;
    }
    row.appendChild(cell);
  }

  var protocolCell = document.createElement("td");
  var badge = document.createElement("span");
  badge.className = "protocol-badge " + getProtocolClass(packet.protocol);
  badge.textContent = packet.protocol;
  protocolCell.appendChild(badge);
  row.appendChild(protocolCell);

  appendCell(row, packet.length === null ? "N/A" : packet.length, "");
  appendCell(row, packet.sourcePort === null ? "—" : packet.sourcePort, "port-cell");
  appendCell(row, packet.destinationPort === null ? "—" : packet.destinationPort, "port-cell");
  return row;
}

// This function appends a text-only table cell so packet data cannot become HTML.
function appendCell(row, value, className) {
  var cell = document.createElement("td");
  cell.textContent = String(value);
  if (className) {
    cell.className = className;
  }
  row.appendChild(cell);
}

/* 6) EVENT LISTENERS */

// This function opens the operating-system file chooser when Browse file is clicked.
function openFilePicker() {
  document.getElementById("fileInput").click();
}

// This function highlights the upload area while a file is dragged over it.
function handleDragOver(event) {
  event.preventDefault();
  document.getElementById("dropZone").classList.add("drag-active");
}

// This function removes the drag highlight when a file leaves the upload area.
function handleDragLeave(event) {
  event.preventDefault();
  document.getElementById("dropZone").classList.remove("drag-active");
}

// This function reads the first dropped file just like a file chosen in the picker.
function handleDrop(event) {
  event.preventDefault();
  document.getElementById("dropZone").classList.remove("drag-active");
  var file = event.dataTransfer.files && event.dataTransfer.files[0];
  if (!file) {
    return;
  }
  var reader = new FileReader();
  appState.fileName = file.name;
  reader.onload = handleFileRead;
  reader.onerror = handleFileReadError;
  reader.readAsText(file);
}

// This function connects buttons, search, filters, and drag-and-drop when the page opens.
function addEventListeners() {
  document.getElementById("browseButton").addEventListener("click", openFilePicker);
  document.getElementById("fileInput").addEventListener("change", handleFileSelection);
  document.getElementById("demoButton").addEventListener("click", loadDemoData);
  document.getElementById("searchInput").addEventListener("input", renderPacketTable);
  document.getElementById("protocolFilter").addEventListener("change", renderPacketTable);
  document.getElementById("dropZone").addEventListener("dragover", handleDragOver);
  document.getElementById("dropZone").addEventListener("dragleave", handleDragLeave);
  document.getElementById("dropZone").addEventListener("drop", handleDrop);
}

// This function starts the page by connecting the controls and leaving the empty state visible.
function startPacketScope() {
  addEventListeners();
}

document.addEventListener("DOMContentLoaded", startPacketScope);
