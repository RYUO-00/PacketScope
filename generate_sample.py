"""Create a deterministic, realistic packet-capture CSV for the PacketScope demo."""

import csv
import random
from pathlib import Path


OUTPUT_FILE = Path(__file__).with_name("sample.csv")
PACKET_TOTAL = 1500
RANDOM_SEED = 42

HEADERS = [
    "frame.number",
    "frame.time_relative",
    "ip.src",
    "ip.dst",
    "_ws.col.Protocol",
    "frame.len",
    "tcp.srcport",
    "tcp.dstport",
]

CLIENT_IPS = ["192.168.1." + str(number) for number in range(10, 22)]
SERVER_IPS = [
    "8.8.8.8",
    "1.1.1.1",
    "142.250.72.14",
    "104.16.132.229",
    "151.101.1.69",
    "13.107.42.14",
]


def choose_packet_time(randomizer):
    """Choose a packet time, keeping a deliberately busy burst near second 14."""
    second_counts = [40 for _ in range(30)]
    second_counts[14] = 230
    remaining_packets = PACKET_TOTAL - sum(second_counts)

    for _ in range(remaining_packets):
        second = randomizer.randrange(30)
        while second == 14:
            second = randomizer.randrange(30)
        second_counts[second] += 1

    packet_times = []
    for second, count in enumerate(second_counts):
        for _ in range(count):
            packet_times.append(second + randomizer.random() * 0.999)

    packet_times.sort()
    return packet_times


def choose_protocol(randomizer):
    """Choose a protocol using weights that make web and name-service traffic common."""
    protocols = ["TLSv1.3", "DNS", "TCP", "HTTP", "ICMP", "ARP", "UDP", "QUIC"]
    weights = [40, 13, 12, 8, 6, 5, 7, 9]
    return randomizer.choices(protocols, weights=weights, k=1)[0]


def choose_packet_length(randomizer, protocol):
    """Return a believable frame length for the selected protocol and payload type."""
    if protocol == "ARP":
        return 60
    if protocol == "DNS":
        return randomizer.randint(70, 180)
    if protocol == "ICMP":
        return randomizer.randint(74, 140)
    if protocol in ("TLSv1.3", "QUIC"):
        return randomizer.randint(700, 1500)
    if protocol == "HTTP":
        return randomizer.randint(180, 1300)
    return randomizer.randint(60, 1450)


def make_packet_row(randomizer, frame_number, packet_time):
    """Build one CSV row with matching IP addresses, ports, and packet size."""
    protocol = choose_protocol(randomizer)
    length = choose_packet_length(randomizer, protocol)
    client_ip = randomizer.choice(CLIENT_IPS)
    server_ip = randomizer.choice(SERVER_IPS)
    source_port = ""
    destination_port = ""

    if protocol == "ARP":
        source_ip = ""
        destination_ip = ""
    elif protocol == "ICMP":
        source_ip = client_ip
        destination_ip = server_ip
    else:
        source_ip = client_ip
        destination_ip = server_ip
        if protocol in ("TLSv1.3", "TCP", "HTTP"):
            source_port = str(randomizer.randint(49152, 65535))

        if protocol == "HTTP":
            destination_port = "80"
        elif protocol in ("TLSv1.3", "TCP"):
            destination_port = "443"

        if randomizer.random() < 0.18:
            source_ip, destination_ip = destination_ip, source_ip
            source_port, destination_port = destination_port, source_port

    return [
        frame_number,
        format(packet_time, ".6f"),
        source_ip,
        destination_ip,
        protocol,
        length,
        source_port,
        destination_port,
    ]


def main():
    """Write 1,500 sorted packet rows so the dashboard can be tried without Wireshark."""
    randomizer = random.Random(RANDOM_SEED)
    packet_times = choose_packet_time(randomizer)

    with OUTPUT_FILE.open("w", newline="", encoding="utf-8") as csv_file:
        writer = csv.writer(csv_file)
        writer.writerow(HEADERS)
        for frame_number, packet_time in enumerate(packet_times, start=1):
            writer.writerow(make_packet_row(randomizer, frame_number, packet_time))

    print("Created {} with {} packet rows.".format(OUTPUT_FILE.name, PACKET_TOTAL))


if __name__ == "__main__":
    main()
