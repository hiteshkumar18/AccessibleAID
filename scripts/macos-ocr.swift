#!/usr/bin/env swift
// macOS Vision OCR — accurate, on-device, uses Apple's ML text recognition.
// Usage: swift macos-ocr.swift <image-path>
// Prints recognised lines top-to-bottom, one per line.
import Vision
import AppKit

guard CommandLine.arguments.count > 1 else { exit(1) }

guard
    let image = NSImage(contentsOfFile: CommandLine.arguments[1]),
    let tiff  = image.tiffRepresentation,
    let ci    = CIImage(data: tiff)
else {
    fputs("load-failed\n", stderr)
    exit(1)
}

var lines: [String] = []
let sema = DispatchSemaphore(value: 0)

let req = VNRecognizeTextRequest { r, _ in
    defer { sema.signal() }
    guard let obs = r.results as? [VNRecognizedTextObservation] else { return }
    let sorted = obs.sorted { $0.boundingBox.maxY > $1.boundingBox.maxY }
    for o in sorted {
        if let top = o.topCandidates(1).first {
            let s = top.string.trimmingCharacters(in: .whitespacesAndNewlines)
            if !s.isEmpty { lines.append(s) }
        }
    }
}

req.recognitionLevel = .accurate
req.usesLanguageCorrection = true

try? VNImageRequestHandler(ciImage: ci).perform([req])
sema.wait()

print(lines.joined(separator: "\n"))
