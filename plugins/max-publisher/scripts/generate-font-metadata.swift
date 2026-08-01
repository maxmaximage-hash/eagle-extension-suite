import CoreText
import Foundation

struct Coverage: Codable {
    let latin: Double
    let han: Double
    let kana: Double
    let hangul: Double
    let arabic: Double
    let devanagari: Double
}

struct FontMetadata: Codable {
    let family: String
    let postscriptName: String
    let language: String
    let style: String
    let confidence: String
    let source: String
    let familyClass: Int
    let panose: [UInt8]
    let fixedPitch: Bool
    let languages: [String]
    let coverage: Coverage
}

func readUInt16(_ bytes: [UInt8], _ offset: Int) -> UInt16 {
    guard bytes.count >= offset + 2 else { return 0 }
    return UInt16(bytes[offset]) << 8 | UInt16(bytes[offset + 1])
}

func readUInt32(_ bytes: [UInt8], _ offset: Int) -> UInt32 {
    guard bytes.count >= offset + 4 else { return 0 }
    return UInt32(bytes[offset]) << 24 |
        UInt32(bytes[offset + 1]) << 16 |
        UInt32(bytes[offset + 2]) << 8 |
        UInt32(bytes[offset + 3])
}

func glyphCoverage(_ font: CTFont, sample: String) -> Double {
    let characters = Array(sample.utf16)
    guard !characters.isEmpty else { return 0 }
    var glyphs = [CGGlyph](repeating: 0, count: characters.count)
    characters.withUnsafeBufferPointer { characterBuffer in
        glyphs.withUnsafeMutableBufferPointer { glyphBuffer in
            _ = CTFontGetGlyphsForCharacters(
                font,
                characterBuffer.baseAddress!,
                glyphBuffer.baseAddress!,
                characters.count
            )
        }
    }
    return Double(glyphs.filter { $0 != 0 }.count) / Double(characters.count)
}

func containsAny(_ value: String, _ needles: [String]) -> Bool {
    let normalized = value.lowercased()
    return needles.contains { normalized.contains($0) }
}

func detectLanguage(family: String, postscriptName: String, languages: [String], coverage: Coverage) -> String {
    let identity = "\(family) \(postscriptName)"
    let japanese = ["hiragino", "yu mincho", "yu gothic", "kana", "japanese"]
    let korean = ["apple sd gothic", "applegothic", "applemyungjo", "nanum", "malgun", "dotum", "batang", "korean"]
    let otherScripts = ["arabic", "hebrew", "devanagari", "gurmukhi", "gujarati", "bangla", "bengali", "tamil", "telugu", "kannada", "malayalam", "sinhala", "thai", "lao", "khmer", "myanmar", "oriya", "diwan", "kufi", "thuluth", "naskh", "farah", "kohinoor"]
    let explicitChinese = containsAny(identity, ["cjk sc", "cjk tc", "source han", "pingfang", "heiti", "songti", "kaiti", "fangsong", "simsun", "simhei", "yahei", "hans", "hant", "gb", "lantinghei"])
    let normalizedLanguages = languages.map { $0.lowercased() }
    let declaresChinese = normalizedLanguages.contains { $0.hasPrefix("zh") }
    let declaresEnglish = normalizedLanguages.contains { $0 == "en" || $0.hasPrefix("en-") }
    let declaresOtherTarget = normalizedLanguages.contains {
        ["ko", "ja", "ar", "he", "hi", "th", "lo", "km", "my", "bn", "ta", "te", "kn", "ml", "si", "gu", "pa", "or"].contains(String($0.prefix(2)))
    }

    if containsAny(identity, korean) || coverage.hangul >= 0.45 { return "exclude" }
    if containsAny(identity, japanese) && !identity.lowercased().contains("sans gb") { return "exclude" }
    if containsAny(identity, otherScripts) || coverage.arabic >= 0.45 || coverage.devanagari >= 0.45 { return "exclude" }
    if explicitChinese || declaresChinese || coverage.han >= 0.45 { return "zh" }
    if coverage.kana >= 0.65 && coverage.han >= 0.2 { return "exclude" }
    if declaresOtherTarget && !declaresEnglish { return "exclude" }
    if coverage.latin >= 0.55 { return "latin" }
    return "exclude"
}

func detectStyle(family: String, familyClass: Int, panose: [UInt8], fixedPitch: Bool) -> (String, String, String) {
    if fixedPitch { return ("other", "high", "post.isFixedPitch") }

    let majorClass = familyClass >> 8
    if (1...7).contains(majorClass) { return ("serif", "high", "OS/2.sFamilyClass") }
    if majorClass == 8 { return ("sans", "high", "OS/2.sFamilyClass") }
    if majorClass == 9 { return ("other", "high", "OS/2.sFamilyClass") }
    if majorClass == 10 { return ("handwriting", "high", "OS/2.sFamilyClass") }

    if panose.count == 10 {
        if panose[0] == 3 { return ("handwriting", "high", "OS/2.PANOSE") }
        if panose[0] == 4 { return ("other", "high", "OS/2.PANOSE") }
        if panose[0] == 2 {
            if (2...10).contains(panose[1]) { return ("serif", "high", "OS/2.PANOSE") }
            if (11...15).contains(panose[1]) { return ("sans", "high", "OS/2.PANOSE") }
        }
    }

    let normalized = family.lowercased()
    if containsAny(normalized, ["script", "hand", "brush", "calligraphy", "cursive", "signature", "楷", "行", "草", "隶", "书法", "手写", "签名"]) {
        return ("handwriting", "medium", "family-name")
    }
    if containsAny(normalized, ["mono", "display", "headline", "title", "decorative", "圆体", "标题", "综艺", "装饰"]) {
        return ("other", "medium", "family-name")
    }
    if containsAny(normalized, ["serif", "times", "georgia", "baskerville", "didot", "garamond", "bodoni", "palatino", "caslon", "song", "宋", "明", "仿宋"]) {
        return ("serif", "medium", "family-name")
    }
    if containsAny(normalized, ["sans", "gothic", "arial", "helvetica", "avenir", "futura", "黑体", "雅黑", "苹方", "等线"]) {
        return ("sans", "medium", "family-name")
    }
    return ("other", "low", "unclassified")
}

let latinSample = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
let hanSample = "的一是在不了有和人这中大为上个国我以要他时来用们生到作地于出就分对成会可主发年动同工也能下过子说产种面而方后多定行学法所民得经十三之进着等部度家电力里如水化高自二理起小物现实加量都两体制机当使点从业本去把性好应开它合还因由其些然前外天政四日那社义事平形相全表间样与关各重"
let kanaSample = "あいうえおかきくけこアイウエオカキクケコ"
let hangulSample = "가나다라마바사아자차카타파하"
let arabicSample = "ابتثجحخدذرزسشصضطظعغفقكلمنهوي"
let devanagariSample = "अआइईउऊकखगघचछजझटठडढतथदधनपफबभमयरलवशषसह"

let postscriptNames = (CTFontManagerCopyAvailablePostScriptNames() as? [String] ?? []).sorted()
var records: [String: FontMetadata] = [:]

for postscriptName in postscriptNames {
    let font = CTFontCreateWithName(postscriptName as CFString, 16, nil)
    let family = CTFontCopyFamilyName(font) as String
    var familyClass = 0
    var panose: [UInt8] = []
    var fixedPitch = false

    if let data = CTFontCopyTable(font, CTFontTableTag(kCTFontTableOS2), []) as Data? {
        let bytes = [UInt8](data)
        if bytes.count >= 42 {
            familyClass = Int(readUInt16(bytes, 30))
            panose = Array(bytes[32..<42])
        }
    }
    if let data = CTFontCopyTable(font, CTFontTableTag(kCTFontTablePost), []) as Data? {
        let bytes = [UInt8](data)
        fixedPitch = bytes.count >= 16 && readUInt32(bytes, 12) != 0
    }

    let coverage = Coverage(
        latin: glyphCoverage(font, sample: latinSample),
        han: glyphCoverage(font, sample: hanSample),
        kana: glyphCoverage(font, sample: kanaSample),
        hangul: glyphCoverage(font, sample: hangulSample),
        arabic: glyphCoverage(font, sample: arabicSample),
        devanagari: glyphCoverage(font, sample: devanagariSample)
    )
    let languages = (CTFontCopySupportedLanguages(font) as? [String] ?? []).sorted()
    let language = detectLanguage(family: family, postscriptName: postscriptName, languages: languages, coverage: coverage)
    let styleResult = detectStyle(family: family, familyClass: familyClass, panose: panose, fixedPitch: fixedPitch)
    records[postscriptName] = FontMetadata(
        family: family,
        postscriptName: postscriptName,
        language: language,
        style: styleResult.0,
        confidence: styleResult.1,
        source: styleResult.2,
        familyClass: familyClass,
        panose: panose,
        fixedPitch: fixedPitch,
        languages: languages,
        coverage: coverage
    )
}

let encoder = JSONEncoder()
encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
let payload: [String: Any] = [
    "version": 1,
    "generatedAt": ISO8601DateFormatter().string(from: Date()),
    "fonts": try JSONSerialization.jsonObject(with: encoder.encode(records))
]
let json = try JSONSerialization.data(withJSONObject: payload, options: [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes])
let output = "window.MAX_FONT_METADATA = " + String(data: json, encoding: .utf8)! + ";\n"

guard CommandLine.arguments.count > 1 else {
    FileHandle.standardOutput.write(output.data(using: .utf8)!)
    exit(0)
}
try output.write(toFile: CommandLine.arguments[1], atomically: true, encoding: .utf8)
