# PacketScope

PacketScope turns a Wireshark packet capture exported to CSV into an interactive network dashboard. It summarizes packet counts, sizes, protocols, source IPs, and activity over time. The dashboard also provides protocol-layer references, plain-English observations, and a searchable packet table.

## Capture and run

1. Open Wireshark, choose the network interface you want to inspect, and start capturing.
2. Stop the capture when you have enough traffic, then save it as a `.pcapng` file.
3. From a terminal, export the fields PacketScope reads (replace `capture.pcapng` with your capture file name):

   ```bash
   tshark -r capture.pcapng -T fields -E header=y -E separator=, -E quote=d -E occurrence=f -e frame.number -e frame.time_relative -e ip.src -e ip.dst -e _ws.col.Protocol -e frame.len -e tcp.srcport -e tcp.dstport > capture.csv
   ```

4. Open `index.html` in a browser and choose `capture.csv`, or serve this folder and open `http://localhost:8000`:

   ```bash
   python -m http.server 8000
   ```

   Then click **Load Demo Data** to load the generated `sample.csv`. If you open the page by double-clicking `index.html`, browsers block web pages from fetching neighboring files, so the demo button uses a small built-in sample instead. The complete generated capture loads when the page is served over HTTP.

To regenerate the demo capture with Python 3, run `python generate_sample.py` from this folder.

## How it works

The dashboard follows this pipeline: **capture → tshark → CSV → PapaParse → statistics → Chart.js**. Wireshark records frames, `tshark` exports selected fields with a header row, and PapaParse reads each CSV row in the browser. Plain JavaScript converts the fields into packet objects and calculates counts, sizes, IP totals, time buckets, and source talkers. Chart.js draws the four charts, while the same packet objects fill the protocol table, insights, and packet explorer.

## DCN concepts

### Packet and frame

A frame is the data unit sent across a link such as Ethernet or Wi-Fi. A packet usually means the network-layer unit carried inside that frame, such as an IP packet. Wireshark numbers captured frames, and a frame can contain an IP packet, an ARP message, or other link-level data. The `frame.len` field is the captured frame length in bytes.

### Protocols in the dashboard

| Protocol | What it does | Layer shown |
| --- | --- | --- |
| ARP | Finds the link-layer address associated with a local IPv4 address. | Link / Network access |
| ICMP / ICMPv6 | Carries network-control messages, including ping replies and error messages. | Network / Internet |
| IP / IPv6 | Addresses and routes packets between networks. | Network / Internet |
| TCP | Provides a reliable, ordered byte stream between applications. | Transport |
| UDP | Sends independent datagrams without TCP's delivery and ordering guarantees. | Transport |
| QUIC | Provides secure, multiplexed transport over UDP, commonly used by HTTP/3. | Transport (over UDP) |
| DNS | Looks up names such as `example.com` and returns records including IP addresses. | Application |
| HTTP / HTTPS | Transfers web requests and responses; HTTPS is HTTP protected with TLS. | Application |
| TLS / TLSv1.2 / TLSv1.3 | Encrypts and authenticates application connections. | Application |
| DHCP | Assigns IP configuration to devices joining a network. | Application |
| NTP | Synchronizes clocks across networked devices. | Application |
| SSH | Provides encrypted remote login and command access. | Application |
| FTP / SMTP | Transfers files / sends email between systems. | Application |
| mDNS | Resolves names on a local network without a conventional DNS server. | Application |

Layer labels are a simplified OSI/TCP-IP reference for learning. TCP and UDP are transport protocols, IP and ICMP operate at the network layer, and application protocols use those lower layers. ARP works between the link and network layers, so the table calls it Link / Network access.

### Viva questions and model answers

1. **What does PacketScope do?** It reads a Wireshark CSV export and summarizes its packets using charts, statistics, insights, and a searchable table.
2. **What is the difference between a frame and a packet?** A frame is the link-layer unit sent on a local link; it can carry a network-layer packet such as IP.
3. **Why export a CSV with tshark?** It selects useful fields from a capture and gives the dashboard a simple, consistent format to parse.
4. **What is the role of PapaParse?** PapaParse reads CSV rows and headers in the browser so JavaScript can process them as objects.
5. **How do TCP and UDP differ?** TCP provides reliable ordered delivery, while UDP sends datagrams without those built-in guarantees.
6. **What does DNS do?** DNS looks up records for names, often returning an IP address for a hostname.
7. **Why does TLS matter in a capture?** TLS encrypts application data, so observers can usually see connection metadata but not read the protected content.
8. **Which layer does ICMP use?** ICMP is a network-layer protocol used for control and diagnostic messages such as ping.
9. **Why can an ARP row have empty IP fields?** ARP resolves local addresses and is not itself an IP packet, so the exported IP fields can be blank.
10. **How is the busiest second calculated?** Each valid relative timestamp is grouped by `Math.floor(time)`, then the group with the most packets is selected.
