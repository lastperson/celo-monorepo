export default class GoogleStorageUtils {
    static fetchFileFromGoogleStorage(bucketName: string, fileName: string): Promise<string>;
    private static constructGoogleStorageUrl;
}