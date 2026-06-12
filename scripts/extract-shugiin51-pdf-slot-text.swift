import Foundation
import PDFKit

let args = Array(CommandLine.arguments.dropFirst())
let pdfPath = args.first ?? "/Users/hasegawaakihiko/第51回当選者一覧（Web用）.pdf"
let outputPath = optionValue("--out", in: args) ?? "data/work/shugiin-51st-glossary-review/manual-fix/pdf-slot-text.csv"

guard let document = PDFDocument(url: URL(fileURLWithPath: pdfPath)) else {
    fputs("PDFを開けません: \(pdfPath)\n", stderr)
    exit(1)
}

let rects: [CGRect] = [
    CGRect(x: 145, y: 395, width: 125, height: 200),
    CGRect(x: 145, y: 195, width: 125, height: 200),
    CGRect(x: 145, y: 0, width: 125, height: 190),
    CGRect(x: 330, y: 395, width: 90, height: 200),
    CGRect(x: 330, y: 195, width: 90, height: 200),
    CGRect(x: 330, y: 0, width: 90, height: 190),
]

var lines = ["rowNumber,id,pageNumber,slot,rawText"]

for rowNumber in 1...465 {
    let zero = rowNumber - 1
    let pageNumber = 4 + (zero / 6)
    let slot = zero % 6
    guard let page = document.page(at: pageNumber - 1) else {
        lines.append([String(rowNumber), candidateId(rowNumber), String(pageNumber), String(slot), ""].map(escapeCsv).joined(separator: ","))
        continue
    }

    let rect = slotRect(pageNumber: pageNumber, slot: slot)
    let text = page.selection(for: rect)?.string ?? ""
    lines.append([
        String(rowNumber),
        candidateId(rowNumber),
        String(pageNumber),
        String(slot),
        text,
    ].map(escapeCsv).joined(separator: ","))
}

try FileManager.default.createDirectory(at: URL(fileURLWithPath: outputPath).deletingLastPathComponent(), withIntermediateDirectories: true)
try lines.joined(separator: "\n").appending("\n").write(toFile: outputPath, atomically: true, encoding: .utf8)
print(outputPath)

func slotRect(pageNumber: Int, slot: Int) -> CGRect {
    if pageNumber == 81 {
        return rects[min(slot + 3, rects.count - 1)]
    }
    return rects[slot]
}

func candidateId(_ rowNumber: Int) -> String {
    let baselineIds = [
        "aoyama-shigeharu",
        "aoyama-shuhei",
        "akazawa-ryosei",
        "aisawa-ichiro",
        "aoki-hitomi",
        "aoyagi-hitoshi",
        "asada-masumi",
        "asano-satoshi",
        "azuma-kuniyoshi",
        "akaba-kazuyoshi",
        "akama-jiro",
        "akiba-kenya",
        "abe-keishi",
        "abe-tsukasa",
        "abe-toshiko",
        "azuma-toru",
        "azemoto-shogo",
        "aso-taro",
        "iizumi-kamon",
        "igarashi-kiyoshi",
    ]
    if rowNumber <= baselineIds.count {
        return baselineIds[rowNumber - 1]
    }
    return String(format: "candidate-%03d", rowNumber)
}

func optionValue(_ name: String, in args: [String]) -> String? {
    for (index, arg) in args.enumerated() {
        if arg == name, index + 1 < args.count { return args[index + 1] }
        if arg.hasPrefix("\(name)=") { return String(arg.dropFirst(name.count + 1)) }
    }
    return nil
}

func escapeCsv(_ value: String) -> String {
    if value.contains(",") || value.contains("\"") || value.contains("\n") || value.contains("\r") {
        return "\"\(value.replacingOccurrences(of: "\"", with: "\"\""))\""
    }
    return value
}
