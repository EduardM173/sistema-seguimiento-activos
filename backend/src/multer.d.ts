// Augments the global Express namespace with multer's File type.
// Needed because @types/multer may not be available in all build environments;
// multer itself ships as a dependency of @nestjs/platform-express.

declare namespace Express {
  namespace Multer {
    interface File {
      /** Field name specified in the form */
      fieldname: string;
      /** Name of the file on the user's computer */
      originalname: string;
      /** Encoding type of the file */
      encoding: string;
      /** Mime type of the file */
      mimetype: string;
      /** Size of the file in bytes */
      size: number;
      /** The folder to which the file has been saved (DiskStorage) */
      destination: string;
      /** The name of the file within the destination (DiskStorage) */
      filename: string;
      /** The full path to the uploaded file (DiskStorage) */
      path: string;
      /** A Buffer of the entire file (MemoryStorage) */
      buffer: Buffer;
    }
  }
}
