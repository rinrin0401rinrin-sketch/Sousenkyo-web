import AppKit
import Foundation
import PDFKit

struct Candidate {
    let id: String
    let label: String
    let reading: String
    let age: String
    let party: String
    let status: String
    let wins: String
    let district: String
    let pageIndex: Int
    let slot: Int
    let reviewReason: String
}

struct MatchInfo {
    let mixedName: String
    let age: String
    let party: String
    let status: String
    let wins: String
    let tail: String
}

let glossaryHeaders = [
    "id",
    "label",
    "category",
    "reading",
    "description",
    "electionIds",
    "relatedIds",
    "photoUrl",
    "districtLabel",
    "partyLabel",
    "statusLabel",
    "age",
    "wins",
    "seatType",
    "reviewStatus",
]

func run() throws {
    let args = Array(CommandLine.arguments.dropFirst())
    let pdfPath = positionalArgs(args).first ?? "/Users/hasegawaakihiko/第51回当選者一覧（Web用）.pdf"
    let limit = optionValue("--limit", in: args).flatMap(Int.init) ?? 465
    let outputRoot = optionValue("--out", in: args) ?? "data/work/shugiin-51st-glossary-review"
    let electionId = optionValue("--election-id", in: args) ?? "shugiin-51st"

    guard let document = PDFDocument(url: URL(fileURLWithPath: pdfPath)) else {
        fputs("PDFを開けません: \(pdfPath)\n", stderr)
        exit(1)
    }

    let count = min(limit, 465)
    let parsed = parseCandidates(document: document, limit: count)
    let candidates = applyManualOverrides(applyBaselineOverrides(parsed))

    let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
    let outputURL = root.appendingPathComponent(outputRoot, isDirectory: true)
    let photoURL = outputURL.appendingPathComponent("photos", isDirectory: true)
    let contactSheetsURL = outputURL.appendingPathComponent("contact-sheets", isDirectory: true)
    let backupURL = outputURL.appendingPathComponent("photos-before-edge-fix", isDirectory: true)
    try FileManager.default.createDirectory(at: photoURL, withIntermediateDirectories: true)
    try FileManager.default.createDirectory(at: contactSheetsURL, withIntermediateDirectories: true)
    try FileManager.default.createDirectory(at: backupURL, withIntermediateDirectories: true)

    var renderedPages: [Int: NSImage] = [:]
    var csvRows: [[String]] = [glossaryHeaders]
    var reportRows = ["id,page,slot,label,photoFile,notes"]
    var nameRows = ["id,label,reading,age,partyLabel,statusLabel,wins,districtLabel,reviewStatus,reason"]

    for candidate in candidates {
        let pageImage = try renderedPage(candidate.pageIndex, document: document, cache: &renderedPages)
        let photo = cropCandidatePhoto(from: pageImage, pageIndex: candidate.pageIndex, slot: candidate.slot)
        let photoFile = "\(candidate.id).png"
        let photoPath = photoURL.appendingPathComponent(photoFile)
        try writePng(photo, to: photoPath)

        let fixedPixels = try fixConnectedWhiteEdges(at: photoPath, backupDir: backupURL)
        let partyLabel = partyLabels[candidate.party] ?? candidate.party
        let statusLabel = statusLabels[candidate.status] ?? candidate.status
        let seatType = candidate.district.hasPrefix("比") ? "比例" : "小選挙区"
        let reviewStatus = candidate.reviewReason == "baseline-ok" || candidate.reviewReason.hasPrefix("manual-fixed") ? "ok" : "needs-review"
        let description = "\(candidate.district) / \(partyLabel) / \(statusLabel) / 当選\(candidate.wins)回 / \(candidate.age)歳"

        csvRows.append([
            candidate.id,
            candidate.label,
            "candidate",
            candidate.reading,
            description,
            electionId,
            "",
            "\(outputRoot)/photos/\(photoFile)",
            candidate.district,
            partyLabel,
            statusLabel,
            candidate.age,
            candidate.wins,
            seatType,
            reviewStatus,
        ])

        let notes = [candidate.reviewReason, fixedPixels > 0 ? "edge-fixed:\(fixedPixels)" : "edge-ok"].joined(separator: "|")
        reportRows.append("\(candidate.id),\(candidate.pageIndex + 1),\(candidate.slot),\(candidate.label),\(photoFile),\(notes)")
        nameRows.append([
            candidate.id,
            candidate.label,
            candidate.reading,
            candidate.age,
            partyLabel,
            statusLabel,
            candidate.wins,
            candidate.district,
            reviewStatus,
            candidate.reviewReason,
        ].map(escapeCsv).joined(separator: ","))
    }

    try writeText(csvRows.map { row in row.map(escapeCsv).joined(separator: ",") }.joined(separator: "\n") + "\n", to: outputURL.appendingPathComponent("candidates.csv"))
    try writeText(reportRows.joined(separator: "\n") + "\n", to: outputURL.appendingPathComponent("extract-report.csv"))
    try writeText(nameRows.joined(separator: "\n") + "\n", to: outputURL.appendingPathComponent("name-reading-report.csv"))
    try writeContactSheets(candidates: candidates, photoDir: photoURL, outputDir: contactSheetsURL)

    print("Generated \(candidates.count) candidate review row(s)")
    print("- \(outputRoot)/candidates.csv")
    print("- \(outputRoot)/extract-report.csv")
    print("- \(outputRoot)/name-reading-report.csv")
    print("- \(outputRoot)/photos/")
    print("- \(outputRoot)/contact-sheets/")
}

func parseCandidates(document: PDFDocument, limit: Int) -> [Candidate] {
    var candidates: [Candidate] = []
    let bodyRegex = try! NSRegularExpression(
        pattern: #"([\p{Han}々〆ヶぁ-んァ-ヶー・]{2,42})([0-9０-９]{2})([自立維国公共れ参保社中無ゆみ])([新前元])([①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳])"#
    )

    for pageIndex in 3..<document.pageCount {
        guard candidates.count < limit else { break }
        let raw = document.page(at: pageIndex)?.string ?? ""
        let text = normalizeText(raw)
        let ns = text as NSString
        let matches = bodyRegex.matches(in: text, range: NSRange(location: 0, length: ns.length))
        let expectedSlots = pageIndex == 80 ? 3 : 6

        for slot in 0..<expectedSlots {
            guard candidates.count < limit else { break }
            guard slot < matches.count else {
                let index = candidates.count + 1
                candidates.append(fallbackCandidate(index: index, pageIndex: pageIndex, slot: slot, reason: "text-match-missing"))
                continue
            }
            let match = matches[slot]
            let nextStart = slot + 1 < matches.count ? matches[slot + 1].range.location : ns.length
            let tailStart = match.range.location + match.range.length
            let tailRange = NSRange(location: tailStart, length: max(0, nextStart - tailStart))
            let info = MatchInfo(
                mixedName: ns.substring(with: match.range(at: 1)),
                age: normalizeDigits(ns.substring(with: match.range(at: 2))),
                party: ns.substring(with: match.range(at: 3)),
                status: ns.substring(with: match.range(at: 4)),
                wins: winsNumber(ns.substring(with: match.range(at: 5))),
                tail: ns.substring(with: tailRange)
            )
            let index = candidates.count + 1
            candidates.append(candidate(from: info, index: index, pageIndex: pageIndex, slot: slot))
        }
    }

    return candidates
}

func fallbackCandidate(index: Int, pageIndex: Int, slot: Int, reason: String) -> Candidate {
    Candidate(
        id: "\(String(format: "candidate-%03d", index))",
        label: "候補者\(index)",
        reading: "",
        age: "",
        party: "",
        status: "",
        wins: "",
        district: "区分確認中",
        pageIndex: pageIndex,
        slot: slot,
        reviewReason: reason
    )
}

func candidate(from info: MatchInfo, index: Int, pageIndex: Int, slot: Int) -> Candidate {
    let district = extractDistrict(from: info.tail)
    let label = cleanLabel(info.mixedName)
    let reading = cleanReading(mixed: info.mixedName, tail: info.tail, district: district)
    let id = "\(String(format: "candidate-%03d", index))"
    var reasons: [String] = []
    if label.count < 2 || label.count > 8 { reasons.append("label-suspicious") }
    if reading.isEmpty || reading.count > 18 { reasons.append("reading-suspicious") }
    if district.isEmpty { reasons.append("district-missing") }
    if partyLabels[info.party] == nil { reasons.append("unknown-party:\(info.party)") }
    if statusLabels[info.status] == nil { reasons.append("unknown-status:\(info.status)") }
    if info.wins.isEmpty { reasons.append("wins-missing") }
    if reasons.isEmpty { reasons.append("auto-parse") }

    return Candidate(
        id: id,
        label: label.isEmpty ? "候補者\(index)" : label,
        reading: reading,
        age: info.age,
        party: info.party,
        status: info.status,
        wins: info.wins,
        district: district.isEmpty ? "区分確認中" : district,
        pageIndex: pageIndex,
        slot: slot,
        reviewReason: reasons.joined(separator: "|")
    )
}

func applyBaselineOverrides(_ parsed: [Candidate]) -> [Candidate] {
    var output = parsed
    for (index, baseline) in baselineCandidates.enumerated() where index < output.count {
        output[index] = baseline
    }
    return output
}

func applyManualOverrides(_ parsed: [Candidate]) -> [Candidate] {
    var output = parsed
    let overrides = [
        462: Candidate(id: "candidate-463", label: "渡辺 真太朗", reading: "わたなべ しんたろう", age: "33", party: "無", status: "新", wins: "1", district: "栃木3区", pageIndex: 80, slot: 0, reviewReason: "manual-fixed-final-page"),
        463: Candidate(id: "candidate-464", label: "渡辺 創", reading: "わたなべ そう", age: "48", party: "中", status: "前", wins: "3", district: "宮崎1区", pageIndex: 80, slot: 1, reviewReason: "manual-fixed-final-page"),
        464: Candidate(id: "candidate-465", label: "渡辺 博道", reading: "わたなべ ひろみち", age: "75", party: "自", status: "元", wins: "9", district: "千葉6区", pageIndex: 80, slot: 2, reviewReason: "manual-fixed-final-page"),
    ]
    for (index, candidate) in overrides where index < output.count {
        output[index] = candidate
    }
    return output
}

func cleanLabel(_ mixed: String) -> String {
    var text = mixed
    for block in proportionalBlocks {
        if let range = text.range(of: block) {
            text = String(text[range.upperBound...])
        }
    }
    if let lastDistrict = text.range(of: #"[一-龥]{2,4}[0-9０-９一二三四五六七八九十]{1,3}区"#, options: .regularExpression, range: nil, locale: nil) {
        text = String(text[lastDistrict.upperBound...])
    }
    let kept = text.filter { char in
        String(char).range(of: #"[\p{Han}々〆ヶ]"#, options: .regularExpression) != nil
    }
    return trimKnownPrefixes(String(kept))
}

func trimKnownPrefixes(_ value: String) -> String {
    var text = value
    let prefixes = ["東京", "大阪", "京都", "兵庫", "愛知", "福岡", "神奈川", "北海道", "東北", "北関東", "南関東", "北陸信越", "東海", "近畿", "中国", "四国", "九州", "比", "区", "道", "県", "市", "院", "三", "五", "七"]
    var changed = true
    while changed {
        changed = false
        for prefix in prefixes where text.hasPrefix(prefix) && text.count > 4 {
            text = String(text.dropFirst(prefix.count))
            changed = true
        }
    }
    return text
}

func cleanReading(mixed: String, tail: String, district: String) -> String {
    let mixedKana = hiraganaOnly(mixed)
    var tailSource = tail
    if !district.isEmpty, let range = tailSource.range(of: district) {
        tailSource = String(tailSource[..<range.lowerBound])
    }
    let tailKana = longestHiraganaRun(tailSource)
    let reading = mixedKana.isEmpty ? tailKana : mixedKana
    return formatReading(reading)
}

func extractDistrict(from tail: String) -> String {
    let patterns = [
        #"比(?:北海道|東北|北関東|南関東|東京|北陸信越|東海|近畿|中国|四国|九州)"#,
        #"[一-龥]{2,4}[0-9０-９一二三四五六七八九十]{1,3}区"#,
    ]
    for pattern in patterns {
        if let range = tail.range(of: pattern, options: .regularExpression) {
            return normalizeDigits(String(tail[range]))
        }
    }
    return ""
}

func hiraganaOnly(_ value: String) -> String {
    String(value.filter { String($0).range(of: #"[ぁ-ん]"#, options: .regularExpression) != nil })
}

func longestHiraganaRun(_ value: String) -> String {
    let regex = try! NSRegularExpression(pattern: #"[ぁ-ん]{2,24}"#)
    let ns = value as NSString
    return regex.matches(in: value, range: NSRange(location: 0, length: ns.length))
        .map { ns.substring(with: $0.range) }
        .max { $0.count < $1.count } ?? ""
}

func formatReading(_ value: String) -> String {
    value.trimmingCharacters(in: .whitespacesAndNewlines)
}

func normalizeText(_ value: String) -> String {
    normalizeFullwidthDigits(value)
        .replacingOccurrences(of: "\n", with: "")
        .replacingOccurrences(of: " ", with: "")
        .replacingOccurrences(of: "　", with: "")
}

func normalizeDigits(_ value: String) -> String {
    normalizeFullwidthDigits(value)
}

func normalizeFullwidthDigits(_ value: String) -> String {
    let map: [Character: Character] = [
        "０": "0", "１": "1", "２": "2", "３": "3", "４": "4",
        "５": "5", "６": "6", "７": "7", "８": "8", "９": "9",
    ]
    return String(value.map { map[$0] ?? $0 })
}

func winsNumber(_ value: String) -> String {
    let map = [
        "①": "1", "②": "2", "③": "3", "④": "4", "⑤": "5",
        "⑥": "6", "⑦": "7", "⑧": "8", "⑨": "9", "⑩": "10",
        "⑪": "11", "⑫": "12", "⑬": "13", "⑭": "14", "⑮": "15",
        "⑯": "16", "⑰": "17", "⑱": "18", "⑲": "19", "⑳": "20",
    ]
    return map[value] ?? ""
}

func optionValue(_ name: String, in args: [String]) -> String? {
    for (index, arg) in args.enumerated() {
        if arg == name, index + 1 < args.count { return args[index + 1] }
        if arg.hasPrefix("\(name)=") { return String(arg.dropFirst(name.count + 1)) }
    }
    return nil
}

func positionalArgs(_ args: [String]) -> [String] {
    var values: [String] = []
    var skipNext = false
    let optionsWithValues = Set(["--limit", "--out", "--election-id"])
    for arg in args {
        if skipNext { skipNext = false; continue }
        if optionsWithValues.contains(arg) { skipNext = true; continue }
        if arg.hasPrefix("--") { continue }
        values.append(arg)
    }
    return values
}

func renderedPage(_ pageIndex: Int, document: PDFDocument, cache: inout [Int: NSImage]) throws -> NSImage {
    if let image = cache[pageIndex] { return image }
    guard let page = document.page(at: pageIndex) else {
        throw NSError(domain: "extract", code: 1, userInfo: [NSLocalizedDescriptionKey: "missing page \(pageIndex + 1)"])
    }
    let bounds = page.bounds(for: .mediaBox)
    let scale: CGFloat = 2.0
    let image = NSImage(size: NSSize(width: bounds.width * scale, height: bounds.height * scale))
    image.lockFocus()
    NSColor.white.setFill()
    NSRect(x: 0, y: 0, width: image.size.width, height: image.size.height).fill()
    guard let context = NSGraphicsContext.current?.cgContext else {
        image.unlockFocus()
        throw NSError(domain: "extract", code: 2, userInfo: [NSLocalizedDescriptionKey: "missing graphics context"])
    }
    context.saveGState()
    context.scaleBy(x: scale, y: scale)
    page.draw(with: .mediaBox, to: context)
    context.restoreGState()
    image.unlockFocus()
    cache[pageIndex] = image
    return image
}

func cropCandidatePhoto(from pageImage: NSImage, pageIndex: Int, slot: Int) -> NSImage {
    let leftX: CGFloat = 126
    let rightX: CGFloat = 478
    let topYs: [CGFloat] = [92, 456, 819]
    let column = pageIndex == 80 || slot >= 3 ? 1 : 0
    let row = slot % 3
    let sourceX = column == 0 ? leftX : rightX
    let sourceTopY = topYs[row]
    let source = crop(from: pageImage, x: sourceX, topY: sourceTopY, width: 178, height: 255)
    return makeIdPhoto(source)
}

func crop(from image: NSImage, x: CGFloat, topY: CGFloat, width: CGFloat, height: CGFloat) -> NSImage {
    let rect = NSRect(x: x, y: image.size.height - topY - height, width: width, height: height)
    let output = NSImage(size: rect.size)
    output.lockFocus()
    image.draw(at: .zero, from: rect, operation: .copy, fraction: 1.0)
    output.unlockFocus()
    return output
}

func makeIdPhoto(_ source: NSImage) -> NSImage {
    let width: CGFloat = 270
    let height: CGFloat = 360
    let corner: CGFloat = 30
    let output = NSImage(size: NSSize(width: width, height: height))
    output.lockFocus()
    photoBackground.setFill()
    NSRect(x: 0, y: 0, width: width, height: height).fill()
    NSBezierPath(roundedRect: NSRect(x: 0, y: 0, width: width, height: height), xRadius: corner, yRadius: corner).addClip()
    let scale = max(width / source.size.width, height / source.size.height)
    let drawWidth = source.size.width * scale
    let drawHeight = source.size.height * scale
    source.draw(in: NSRect(x: (width - drawWidth) / 2, y: (height - drawHeight) / 2, width: drawWidth, height: drawHeight), from: .zero, operation: .sourceOver, fraction: 1.0)
    output.unlockFocus()
    return output
}

func fixConnectedWhiteEdges(at url: URL, backupDir: URL) throws -> Int {
    let backup = backupDir.appendingPathComponent(url.lastPathComponent)
    if !FileManager.default.fileExists(atPath: backup.path) {
        try? FileManager.default.copyItem(at: url, to: backup)
    }
    guard let image = NSImage(contentsOf: url), var rect = Optional(NSRect(origin: .zero, size: image.size)), let cg = image.cgImage(forProposedRect: &rect, context: nil, hints: nil) else { return 0 }
    let width = cg.width
    let height = cg.height
    let bytesPerPixel = 4
    let bytesPerRow = width * bytesPerPixel
    var data = [UInt8](repeating: 0, count: height * bytesPerRow)
    guard let context = CGContext(data: &data, width: width, height: height, bitsPerComponent: 8, bytesPerRow: bytesPerRow, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return 0 }
    context.draw(cg, in: CGRect(x: 0, y: 0, width: width, height: height))

    var queue: [(Int, Int)] = []
    var visited = [Bool](repeating: false, count: width * height)
    func enqueue(_ x: Int, _ y: Int) {
        guard x >= 0, y >= 0, x < width, y < height else { return }
        let idx = y * width + x
        guard !visited[idx] else { return }
        visited[idx] = true
        if isEdgeWhite(data, width: width, x: x, y: y) { queue.append((x, y)) }
    }
    for x in 0..<width { enqueue(x, 0); enqueue(x, height - 1) }
    for y in 0..<height { enqueue(0, y); enqueue(width - 1, y) }

    var fixed = 0
    var head = 0
    while head < queue.count {
        let (x, y) = queue[head]
        head += 1
        let offset = (y * width + x) * bytesPerPixel
        data[offset] = 170
        data[offset + 1] = 164
        data[offset + 2] = 159
        fixed += 1
        enqueue(x + 1, y); enqueue(x - 1, y); enqueue(x, y + 1); enqueue(x, y - 1)
    }
    guard fixed > 0 else { return 0 }
    guard let outContext = CGContext(data: &data, width: width, height: height, bitsPerComponent: 8, bytesPerRow: bytesPerRow, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue), let outCg = outContext.makeImage() else { return 0 }
    let rep = NSBitmapImageRep(cgImage: outCg)
    try rep.representation(using: .png, properties: [:])?.write(to: url)
    return fixed
}

func isEdgeWhite(_ data: [UInt8], width: Int, x: Int, y: Int) -> Bool {
    let offset = (y * width + x) * 4
    let r = Int(data[offset])
    let g = Int(data[offset + 1])
    let b = Int(data[offset + 2])
    let a = Int(data[offset + 3])
    if a == 0 { return false }
    return r >= 226 && g >= 226 && b >= 218 && (max(r, max(g, b)) - min(r, min(g, b))) <= 28
}

func writePng(_ image: NSImage, to url: URL) throws {
    guard let tiff = image.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff), let data = rep.representation(using: .png, properties: [:]) else {
        throw NSError(domain: "extract", code: 3, userInfo: [NSLocalizedDescriptionKey: "cannot create png"])
    }
    try data.write(to: url)
}

func writeText(_ text: String, to url: URL) throws {
    try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
    try text.write(to: url, atomically: true, encoding: .utf8)
}

func writeContactSheets(candidates: [Candidate], photoDir: URL, outputDir: URL) throws {
    let chunkSize = 100
    for chunkStart in stride(from: 0, to: candidates.count, by: chunkSize) {
        let chunk = Array(candidates[chunkStart..<min(chunkStart + chunkSize, candidates.count)])
        let cellW: CGFloat = 150
        let cellH: CGFloat = 210
        let cols = 4
        let rows = Int(ceil(Double(chunk.count) / Double(cols)))
        let sheet = NSImage(size: NSSize(width: cellW * CGFloat(cols), height: cellH * CGFloat(rows)))
        sheet.lockFocus()
        NSColor.white.setFill()
        NSRect(x: 0, y: 0, width: sheet.size.width, height: sheet.size.height).fill()
        for (offset, candidate) in chunk.enumerated() {
            guard let photo = NSImage(contentsOf: photoDir.appendingPathComponent("\(candidate.id).png")) else { continue }
            let col = offset % cols
            let row = offset / cols
            let x = CGFloat(col) * cellW
            let y = sheet.size.height - CGFloat(row + 1) * cellH
            photo.draw(in: NSRect(x: x + 25, y: y + 14, width: 100, height: 133))
            let label = "\(candidate.id)\n\(candidate.label)"
            let attrs: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: 9), .foregroundColor: NSColor.black]
            NSAttributedString(string: label, attributes: attrs).draw(in: NSRect(x: x + 5, y: y + 152, width: cellW - 10, height: 45))
        }
        sheet.unlockFocus()
        guard let tiff = sheet.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff), let data = rep.representation(using: .png, properties: [:]) else { continue }
        let sheetNumber = chunkStart / chunkSize + 1
        try data.write(to: outputDir.appendingPathComponent(String(format: "contact-sheet-%02d.png", sheetNumber)))
        if sheetNumber == 1 {
            try data.write(to: outputDir.deletingLastPathComponent().appendingPathComponent("contact-sheet.png"))
        }
    }
}

func escapeCsv(_ value: String) -> String {
    if value.contains(",") || value.contains("\"") || value.contains("\n") || value.contains("\r") {
        return "\"\(value.replacingOccurrences(of: "\"", with: "\"\""))\""
    }
    return value
}

func slug(_ value: String) -> String {
    value.lowercased().components(separatedBy: CharacterSet.alphanumerics.inverted).filter { !$0.isEmpty }.joined(separator: "-")
}

let photoBackground = NSColor(calibratedRed: 0.665, green: 0.645, blue: 0.625, alpha: 1)
let proportionalBlocks = ["比北海道", "比東北", "比北関東", "比南関東", "比東京", "比北陸信越", "比東海", "比近畿", "比中国", "比四国", "比九州"]
let partyLabels = ["自": "自由民主党", "立": "立憲民主党", "維": "日本維新の会", "国": "国民民主党", "公": "公明党", "共": "日本共産党", "れ": "れいわ新選組", "参": "参政党", "保": "日本保守党", "社": "社会民主党", "中": "中道", "無": "無所属", "ゆ": "ゆうこく", "み": "みらい"]
let statusLabels = ["新": "新人", "前": "前職", "元": "元職"]

let baselineCandidates: [Candidate] = [
    Candidate(id: "aoyama-shigeharu", label: "青山 繁晴", reading: "あおやま しげはる", age: "73", party: "自", status: "新", wins: "1", district: "兵庫8区", pageIndex: 3, slot: 0, reviewReason: "baseline-ok"),
    Candidate(id: "aoyama-shuhei", label: "青山 周平", reading: "あおやま しゅうへい", age: "48", party: "自", status: "元", wins: "5", district: "愛知12区", pageIndex: 3, slot: 1, reviewReason: "baseline-ok"),
    Candidate(id: "akazawa-ryosei", label: "赤沢 亮正", reading: "あかざわ りょうせい", age: "65", party: "自", status: "前", wins: "8", district: "鳥取2区", pageIndex: 3, slot: 2, reviewReason: "baseline-ok"),
    Candidate(id: "aisawa-ichiro", label: "逢沢 一郎", reading: "あいさわ いちろう", age: "71", party: "自", status: "前", wins: "14", district: "岡山1区", pageIndex: 3, slot: 3, reviewReason: "baseline-ok"),
    Candidate(id: "aoki-hitomi", label: "青木 ひとみ", reading: "あおき ひとみ", age: "44", party: "参", status: "新", wins: "1", district: "比北関東", pageIndex: 3, slot: 4, reviewReason: "baseline-ok"),
    Candidate(id: "aoyagi-hitoshi", label: "青柳 仁士", reading: "あおやぎ ひとし", age: "47", party: "維", status: "前", wins: "3", district: "大阪14区", pageIndex: 3, slot: 5, reviewReason: "baseline-ok"),
    Candidate(id: "asada-masumi", label: "浅田 真澄美", reading: "あさだ ますみ", age: "59", party: "自", status: "新", wins: "1", district: "比九州", pageIndex: 4, slot: 0, reviewReason: "baseline-ok"),
    Candidate(id: "asano-satoshi", label: "浅野 哲", reading: "あさの さとし", age: "43", party: "国", status: "前", wins: "4", district: "茨城5区", pageIndex: 4, slot: 1, reviewReason: "baseline-ok"),
    Candidate(id: "azuma-kuniyoshi", label: "東 国幹", reading: "あずま くによし", age: "57", party: "自", status: "前", wins: "3", district: "北海道6区", pageIndex: 4, slot: 2, reviewReason: "baseline-ok"),
    Candidate(id: "akaba-kazuyoshi", label: "赤羽 一嘉", reading: "あかば かずよし", age: "67", party: "中", status: "前", wins: "11", district: "比近畿", pageIndex: 4, slot: 3, reviewReason: "baseline-ok"),
    Candidate(id: "akama-jiro", label: "赤間 二郎", reading: "あかま じろう", age: "57", party: "自", status: "前", wins: "7", district: "神奈川14区", pageIndex: 4, slot: 4, reviewReason: "baseline-ok"),
    Candidate(id: "akiba-kenya", label: "秋葉 賢也", reading: "あきば けんや", age: "63", party: "自", status: "元", wins: "8", district: "比東北", pageIndex: 4, slot: 5, reviewReason: "baseline-ok"),
    Candidate(id: "abe-keishi", label: "阿部 圭史", reading: "あべ けいし", age: "39", party: "維", status: "前", wins: "2", district: "兵庫2区", pageIndex: 5, slot: 0, reviewReason: "baseline-ok"),
    Candidate(id: "abe-tsukasa", label: "阿部 司", reading: "あべ つかさ", age: "43", party: "維", status: "前", wins: "3", district: "比東京", pageIndex: 5, slot: 1, reviewReason: "baseline-ok"),
    Candidate(id: "abe-toshiko", label: "阿部 俊子", reading: "あべ としこ", age: "66", party: "自", status: "前", wins: "8", district: "比中国", pageIndex: 5, slot: 2, reviewReason: "baseline-ok"),
    Candidate(id: "azuma-toru", label: "東 徹", reading: "あずま とおる", age: "59", party: "維", status: "前", wins: "2", district: "大阪3区", pageIndex: 5, slot: 3, reviewReason: "baseline-ok"),
    Candidate(id: "azemoto-shogo", label: "畦元 将吾", reading: "あぜもと しょうご", age: "67", party: "自", status: "元", wins: "3", district: "東京6区", pageIndex: 5, slot: 4, reviewReason: "baseline-ok"),
    Candidate(id: "aso-taro", label: "麻生 太郎", reading: "あそう たろう", age: "85", party: "自", status: "前", wins: "16", district: "福岡8区", pageIndex: 5, slot: 5, reviewReason: "baseline-ok"),
    Candidate(id: "iizumi-kamon", label: "飯泉 嘉門", reading: "いいずみ かもん", age: "65", party: "国", status: "新", wins: "1", district: "比四国", pageIndex: 6, slot: 0, reviewReason: "baseline-ok"),
    Candidate(id: "igarashi-kiyoshi", label: "五十嵐 清", reading: "いがらし きよし", age: "56", party: "自", status: "前", wins: "3", district: "栃木2区", pageIndex: 6, slot: 1, reviewReason: "baseline-ok"),
]

try run()
