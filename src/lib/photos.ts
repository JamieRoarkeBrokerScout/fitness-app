// Progress photos are copied into the app's document directory so they survive the
// picker's temporary cache being cleared. The DB stores only the file name, because the
// absolute document path can change between app updates on iOS.
import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';

const PHOTO_DIR = 'progress-photos';

function photoDirectory() {
    const directory = new Directory(Paths.document, PHOTO_DIR);
    if (!directory.exists) {
        directory.create({ intermediates: true, idempotent: true });
    }
    return directory;
}

export function savePhoto(sourceUri: string) {
    const source = new File(sourceUri);
    const extension = source.extension || '.jpg';
    const fileName = `${Crypto.randomUUID()}${extension}`;
    source.copy(new File(photoDirectory(), fileName));
    return fileName;
}

export function photoUri(fileName: string) {
    return new File(Paths.document, PHOTO_DIR, fileName).uri;
}

export function deletePhotoFile(fileName: string) {
    const file = new File(Paths.document, PHOTO_DIR, fileName);
    if (file.exists) {
        file.delete();
    }
}
