import Foundation
import Photos

struct Arguments {
    var imagePath: String?
    var moviePath: String?
    var albumTitle: String = "MAX Live Photo Import Test"
    var resultPath: String?
    var verifyIdentifier: String?
    var listAlbum: Bool = false
    var dryRun: Bool = false
}

enum ImportError: Error, CustomStringConvertible {
    case missingArgument(String)
    case fileNotFound(String)
    case authorizationDenied(PHAuthorizationStatus)
    case albumCreationFailed
    case assetCreationFailed

    var description: String {
        switch self {
        case .missingArgument(let name):
            return "Missing required argument: \(name)"
        case .fileNotFound(let path):
            return "File not found: \(path)"
        case .authorizationDenied(let status):
            return "Photos authorization was not granted: \(status.rawValue)"
        case .albumCreationFailed:
            return "Could not create or fetch the target Photos album."
        case .assetCreationFailed:
            return "Photos did not return a placeholder for the Live Photo asset."
        }
    }
}

func parseArguments(_ values: [String]) throws -> Arguments {
    var arguments = Arguments()
    var index = 0
    while index < values.count {
        let value = values[index]
        switch value {
        case "--image":
            index += 1
            guard index < values.count else { throw ImportError.missingArgument("--image") }
            arguments.imagePath = values[index]
        case "--movie":
            index += 1
            guard index < values.count else { throw ImportError.missingArgument("--movie") }
            arguments.moviePath = values[index]
        case "--album":
            index += 1
            guard index < values.count else { throw ImportError.missingArgument("--album") }
            arguments.albumTitle = values[index]
        case "--result-file":
            index += 1
            guard index < values.count else { throw ImportError.missingArgument("--result-file") }
            arguments.resultPath = values[index]
        case "--verify-id":
            index += 1
            guard index < values.count else { throw ImportError.missingArgument("--verify-id") }
            arguments.verifyIdentifier = values[index]
        case "--list-album":
            arguments.listAlbum = true
        case "--dry-run":
            arguments.dryRun = true
        default:
            throw ImportError.missingArgument(value)
        }
        index += 1
    }
    return arguments
}

func assertReadableFile(_ path: String) throws -> URL {
    let url = URL(fileURLWithPath: path)
    var isDirectory: ObjCBool = false
    if !FileManager.default.fileExists(atPath: path, isDirectory: &isDirectory) || isDirectory.boolValue {
        throw ImportError.fileNotFound(path)
    }
    return url
}

func requestPhotosAccess() throws {
    let semaphore = DispatchSemaphore(value: 0)
    var status: PHAuthorizationStatus = .notDetermined

    if #available(macOS 11.0, *) {
        PHPhotoLibrary.requestAuthorization(for: .readWrite) { value in
            status = value
            semaphore.signal()
        }
    } else {
        PHPhotoLibrary.requestAuthorization { value in
            status = value
            semaphore.signal()
        }
    }

    semaphore.wait()
    guard status == .authorized || status == .limited else {
        throw ImportError.authorizationDenied(status)
    }
}

func fetchAlbum(title: String) -> PHAssetCollection? {
    let options = PHFetchOptions()
    options.predicate = NSPredicate(format: "title = %@", title)
    return PHAssetCollection.fetchAssetCollections(with: .album, subtype: .any, options: options).firstObject
}

func createAlbum(title: String) throws -> PHAssetCollection {
    if let existing = fetchAlbum(title: title) {
        return existing
    }

    var placeholder: PHObjectPlaceholder?
    var changeError: Error?
    let semaphore = DispatchSemaphore(value: 0)
    PHPhotoLibrary.shared().performChanges({
        let request = PHAssetCollectionChangeRequest.creationRequestForAssetCollection(withTitle: title)
        placeholder = request.placeholderForCreatedAssetCollection
    }, completionHandler: { _, error in
        changeError = error
        semaphore.signal()
    })
    semaphore.wait()
    if let changeError {
        throw changeError
    }
    guard let localIdentifier = placeholder?.localIdentifier else {
        throw ImportError.albumCreationFailed
    }

    let result = PHAssetCollection.fetchAssetCollections(withLocalIdentifiers: [localIdentifier], options: nil)
    guard let album = result.firstObject else {
        throw ImportError.albumCreationFailed
    }
    return album
}

func importLivePhoto(imageURL: URL, movieURL: URL, albumTitle: String) throws -> String {
    let album = try createAlbum(title: albumTitle)
    var assetPlaceholder: PHObjectPlaceholder?
    var changeError: Error?
    let semaphore = DispatchSemaphore(value: 0)

    PHPhotoLibrary.shared().performChanges({
        let creationRequest = PHAssetCreationRequest.forAsset()
        let photoOptions = PHAssetResourceCreationOptions()
        photoOptions.shouldMoveFile = false
        let movieOptions = PHAssetResourceCreationOptions()
        movieOptions.shouldMoveFile = false

        creationRequest.addResource(with: .photo, fileURL: imageURL, options: photoOptions)
        creationRequest.addResource(with: .pairedVideo, fileURL: movieURL, options: movieOptions)
        assetPlaceholder = creationRequest.placeholderForCreatedAsset

        if let placeholder = assetPlaceholder,
           let albumRequest = PHAssetCollectionChangeRequest(for: album) {
            albumRequest.addAssets([placeholder] as NSArray)
        }
    }, completionHandler: { _, error in
        changeError = error
        semaphore.signal()
    })

    semaphore.wait()
    if let changeError {
        throw changeError
    }
    guard let localIdentifier = assetPlaceholder?.localIdentifier else {
        throw ImportError.assetCreationFailed
    }
    return localIdentifier
}

func rawResultPath(_ values: [String]) -> String? {
    guard let index = values.firstIndex(of: "--result-file"), index + 1 < values.count else {
        return nil
    }
    return values[index + 1]
}

func describeAsset(localIdentifier: String) -> [String: Any] {
    let fetch = PHAsset.fetchAssets(withLocalIdentifiers: [localIdentifier], options: nil)
    guard let asset = fetch.firstObject else {
        return [
            "assetFound": false,
            "localIdentifier": localIdentifier
        ]
    }
    let resourceTypes = PHAssetResource.assetResources(for: asset).map { resource in
        switch resource.type {
        case .photo:
            return "photo"
        case .video:
            return "video"
        case .pairedVideo:
            return "pairedVideo"
        case .fullSizePhoto:
            return "fullSizePhoto"
        case .fullSizeVideo:
            return "fullSizeVideo"
        case .adjustmentData:
            return "adjustmentData"
        case .adjustmentBasePhoto:
            return "adjustmentBasePhoto"
        case .alternatePhoto:
            return "alternatePhoto"
        case .photoProxy:
            return "photoProxy"
        default:
            return "other-\(resource.type.rawValue)"
        }
    }
    return [
        "assetFound": true,
        "localIdentifier": localIdentifier,
        "mediaType": asset.mediaType.rawValue,
        "isLivePhoto": asset.mediaSubtypes.contains(.photoLive),
        "pixelWidth": asset.pixelWidth,
        "pixelHeight": asset.pixelHeight,
        "duration": asset.duration,
        "resourceTypes": resourceTypes
    ]
}

func listAlbumAssets(title: String) -> [String: Any] {
    guard let album = fetchAlbum(title: title) else {
        return [
            "albumFound": false,
            "albumTitle": title,
            "assets": []
        ]
    }
    let assets = PHAsset.fetchAssets(in: album, options: nil)
    var rows: [[String: Any]] = []
    assets.enumerateObjects { asset, _, _ in
        rows.append(describeAsset(localIdentifier: asset.localIdentifier))
    }
    return [
        "albumFound": true,
        "albumTitle": title,
        "assetCount": assets.count,
        "assets": rows
    ]
}

func writeResult(_ path: String?, status: String, message: String, localIdentifier: String? = nil, asset: [String: Any]? = nil) {
    guard let path else { return }
    var payload: [String: Any] = [
        "status": status,
        "message": message,
        "finishedAt": ISO8601DateFormatter().string(from: Date())
    ]
    if let localIdentifier {
        payload["localIdentifier"] = localIdentifier
    }
    if let asset {
        payload["asset"] = asset
    }
    if let data = try? JSONSerialization.data(withJSONObject: payload, options: [.prettyPrinted, .sortedKeys]) {
        try? data.write(to: URL(fileURLWithPath: path), options: [.atomic])
    }
}

do {
    let rawArguments = Array(CommandLine.arguments.dropFirst())
    let arguments = try parseArguments(rawArguments)

    if let verifyIdentifier = arguments.verifyIdentifier {
        try requestPhotosAccess()
        let asset = describeAsset(localIdentifier: verifyIdentifier)
        print("verification=\(asset)")
        writeResult(arguments.resultPath, status: "verified", message: "Asset verification completed.", localIdentifier: verifyIdentifier, asset: asset)
        exit(0)
    }

    if arguments.listAlbum {
        try requestPhotosAccess()
        let album = listAlbumAssets(title: arguments.albumTitle)
        print("album=\(album)")
        writeResult(arguments.resultPath, status: "listed", message: "Album listing completed.", asset: album)
        exit(0)
    }

    guard let imagePath = arguments.imagePath else { throw ImportError.missingArgument("--image") }
    guard let moviePath = arguments.moviePath else { throw ImportError.missingArgument("--movie") }

    let imageURL = try assertReadableFile(imagePath)
    let movieURL = try assertReadableFile(moviePath)

    print("image=\(imageURL.path)")
    print("movie=\(movieURL.path)")
    print("album=\(arguments.albumTitle)")

    if arguments.dryRun {
        print("dryRun=ok")
        writeResult(arguments.resultPath, status: "dry-run", message: "Input files are readable.")
        exit(0)
    }

    try requestPhotosAccess()
    let localIdentifier = try importLivePhoto(imageURL: imageURL, movieURL: movieURL, albumTitle: arguments.albumTitle)
    let asset = describeAsset(localIdentifier: localIdentifier)
    print("importedAssetLocalIdentifier=\(localIdentifier)")
    writeResult(arguments.resultPath, status: "imported", message: "Live Photo import request completed.", localIdentifier: localIdentifier, asset: asset)
} catch {
    fputs("LivePhotoImporter error: \(error)\n", stderr)
    writeResult(rawResultPath(Array(CommandLine.arguments.dropFirst())), status: "failed", message: "\(error)")
    exit(1)
}
