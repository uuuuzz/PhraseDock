import AppKit
import Foundation

guard CommandLine.arguments.count == 5,
      let canvasSize = Int(CommandLine.arguments[3]),
      let artworkSize = Int(CommandLine.arguments[4]),
      canvasSize > 0, artworkSize > 0, artworkSize <= canvasSize,
      let image = NSImage(contentsOfFile: CommandLine.arguments[1]),
      let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: canvasSize, pixelsHigh: canvasSize,
                                    bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
                                    colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0) else {
    FileHandle.standardError.write(Data("Usage: pad-icon.swift input.png output.png canvas artwork\n".utf8))
    exit(2)
}

NSGraphicsContext.saveGraphicsState()
guard let context = NSGraphicsContext(bitmapImageRep: bitmap) else { exit(3) }
NSGraphicsContext.current = context
context.imageInterpolation = .high
NSColor.clear.setFill()
NSRect(x: 0, y: 0, width: canvasSize, height: canvasSize).fill()
let inset = CGFloat(canvasSize - artworkSize) / 2
image.draw(in: NSRect(x: inset, y: inset, width: CGFloat(artworkSize), height: CGFloat(artworkSize)),
           from: .zero, operation: .sourceOver, fraction: 1)
context.flushGraphics()
NSGraphicsContext.restoreGraphicsState()

guard let png = bitmap.representation(using: .png, properties: [:]) else { exit(4) }
try png.write(to: URL(fileURLWithPath: CommandLine.arguments[2]), options: .atomic)
