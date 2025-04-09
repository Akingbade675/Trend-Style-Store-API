import { PutObjectCommandOutput } from '@aws-sdk/client-s3';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Media, MediaFolder } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { InjectS3, S3 } from 'nestjs-s3';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { v4 as uuid } from 'uuid';
import { UpdateMediaDto } from './dto/update-media.dto';

type UploadedFile = Express.Multer.File;

@Injectable()
export class MediaService {
  private readonly _logger = new Logger(MediaService.name);
  private readonly awsRegion: string;
  private readonly awsS3BucketName: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @InjectS3() private readonly s3: S3,
  ) {
    this.awsRegion = this.configService.getOrThrow('AWS_REGION');
    this.awsS3BucketName = this.configService.getOrThrow('AWS_S3_BUCKET_NAME');
  }

  // Helper to generate S3 Object Key
  private _generateS3Key(
    folder: MediaFolder | string | undefined,
    filename: string,
  ): string {
    const safeFolder = (folder || 'general')
      .toString()
      .replace(/[^a-zA-Z0-9_-]/g, '');
    const uniqueId = uuid();
    return `${safeFolder}/${uniqueId}-${filename}`;
  }

  // Helper to construct public URL
  private _getPublicUrl(key: string): string {
    // if (this.awsS3PublicUrlBase) {
    //     // Ensure no double slashes if base URL ends with / and key starts with /
    //     return `${this.awsS3PublicUrlBase.replace(/\/$/, '')}/${key.replace(/^\//, '')}`;
    // }
    // Default S3 URL pattern
    return `https://${this.awsS3BucketName}.s3.${this.awsRegion}.amazonaws.com/${key}`;
  }

  async create(file: UploadedFile, folder: MediaFolder, altText?: string) {
    if (!file) {
      throw new BadRequestException('No file uploaded.');
    }

    const s3Key = this._generateS3Key(folder, file.originalname);
    const publicUrl = this._getPublicUrl(s3Key);

    let s3UploadSuccessful = false;
    try {
      // Upload to S3
      const uploadedFile: PutObjectCommandOutput = await this.s3.putObject({
        Bucket: this.awsS3BucketName,
        Key: s3Key,
        Body: file.buffer,
        ContentType: file.mimetype,
      });
      s3UploadSuccessful = true;
      this._logger.log(
        `File uploaded successfully to S3: ${s3Key}`,
        uploadedFile,
      );

      // Save metadata to DB
      const media = await this.prisma.media.create({
        data: {
          url: publicUrl,
          filename: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          altText,
          folder,
        },
      });
      this._logger.log(
        `Media record created: ${media.filename} (ID: ${media.id})`,
      );
      return media;
    } catch (error) {
      this._logger.error(
        `Media creation/upload failed: ${error.message}`,
        error.stack,
      );

      // If S3 upload succeeded but DB failed, attempt to delete from S3
      if (
        s3UploadSuccessful &&
        !(error instanceof PrismaClientKnownRequestError)
      ) {
        this._logger.warn(
          `DB insertion failed after S3 upload for key ${s3Key}. Attempting S3 rollback...`,
        );
        try {
          await this.s3.deleteObject({
            Bucket: this.awsS3BucketName,
            Key: s3Key,
          });
          this._logger.log(
            `Successfully deleted orphaned object from S3: ${s3Key}`,
          );
        } catch (rollbackError) {
          this._logger.error(
            `CRITICAL: Failed to delete orphaned object ${s3Key} from S3 after DB error: ${rollbackError.message}`,
            rollbackError.stack,
          );
          // Might need manual cleanup or further logging/alerting here
        }
      }

      // Throw appropriate error for the client
      if (error instanceof PrismaClientKnownRequestError) {
        throw new InternalServerErrorException(
          'Could not save media information to database.',
        );
      } else if (error.name === 'CredentialsProviderError') {
        // Or specific AWS SDK errors
        throw new InternalServerErrorException(
          'AWS Credentials configuration error.',
        );
      } else {
        throw new InternalServerErrorException(
          'Could not upload file or save media information.',
        );
      }
    }
  }

  // --- Private helper to process a single file ---
  private async _processSingleFile(
    file: UploadedFile,
    folder: MediaFolder,
    altText?: string,
    // userId?: string
  ): Promise<Media> {
    const s3Key = this._generateS3Key(folder, file.originalname);
    const publicUrl = this._getPublicUrl(s3Key);

    let s3UploadSuccessful = false;
    try {
      // Upload to S3
      const uploadedFile: PutObjectCommandOutput = await this.s3.putObject({
        Bucket: this.awsS3BucketName,
        Key: s3Key,
        Body: file.buffer,
        ContentType: file.mimetype,
      });
      s3UploadSuccessful = true;
      this._logger.log(
        `File uploaded successfully to S3: ${s3Key}`,
        uploadedFile,
      );

      // Save metadata to DB
      const media = await this.prisma.media.create({
        data: {
          url: publicUrl,
          filename: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          altText,
          folder,
        },
      });
      this._logger.log(
        `Media record created: ${media.filename} (ID: ${media.id})`,
      );
      return media; // Return created Media object on success
    } catch (error) {
      this._logger.error(
        `Processing failed for file ${file.originalname}: ${error.message}`,
        error.stack,
      );
      if (s3UploadSuccessful) {
        this._logger.warn(
          `DB insertion failed after S3 upload for key ${s3Key}. Attempting S3 rollback...`,
        );
        try {
          await this.s3.deleteObject({
            Bucket: this.awsS3BucketName,
            Key: s3Key,
          });
          this._logger.log(
            `Successfully deleted orphaned object from S3: ${s3Key}`,
          );
        } catch (rollbackError) {
          this._logger.error(
            `CRITICAL: Failed to delete orphaned object ${s3Key} from S3 after DB error: ${rollbackError.message}`,
            rollbackError.stack,
          );
        }
        // Re-throw the error to be caught by Promise.allSettled
        throw error;
      }
    }
  }

  // --- Method to handle multiple file uploads ---
  async createMultiple(
    files: UploadedFile[],
    folder: MediaFolder,
    altText?: string, // Applied to all files in this batch
    // userId?: string
  ): Promise<Media[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided.');
    }

    const processingPromises = files.map((file) =>
      this._processSingleFile(file, folder, altText),
    );

    // Use Promise.allSettled to wait for all uploads/saves to finish, regardless of individual failures
    const results = await Promise.allSettled(processingPromises);

    const successfulUploads: Media[] = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successfulUploads.push(result.value);
      } else {
        // Log the error for the specific file that failed
        this._logger.error(
          `Failed to process file ${files[index]?.originalname}: ${result.reason?.message ?? result.reason}`,
        );
        // result.reason contains the error thrown by _processSingleFile
      }
    });

    if (successfulUploads.length === 0 && files.length > 0) {
      this._logger.error(`All ${files.length} file uploads failed.`);
      throw new InternalServerErrorException(
        'Failed to process any uploaded files.',
      );
    } else if (successfulUploads.length < files.length) {
      this._logger.warn(
        `Media upload: ${successfulUploads.length} out of ${files.length} files processed successfully.`,
      );
    } else {
      this._logger.log(`Successfully processed all ${files.length} files.`);
    }

    return successfulUploads; // Return only the successfully created Media records
  }

  async findAll(paginationDto: PaginationDto, folder: MediaFolder) {
    const { page, limit, skip } = paginationDto;

    try {
      const [mediaItems, totalCount] = await this.prisma.$transaction([
        this.prisma.media.findMany({
          where: { folder },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.media.count({ where: { folder } }),
      ]);
      return { count: totalCount, data: mediaItems };
    } catch (error) {
      this._logger.error(`Failed to find media: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Could not retrieve media.');
    }
  }

  async findOne(id: string) {
    const media = await this.prisma.media.findUnique({ where: { id } });
    if (!media) {
      throw new NotFoundException(`Media with ID "${id}" not found.`);
    }
    return media;
  }

  async update(id: string, updateMediaDto: UpdateMediaDto) {
    try {
      const updatedMedia = await this.prisma.media.update({
        where: { id },
        data: updateMediaDto,
      });
      return updatedMedia;
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Media with ID "${id}" not found.`);
      }

      this._logger.error(
        `Failed to update media ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Could not update media.');
    }
  }

  async remove(id: string) {
    // 1. Find media record
    const media = await this.findOne(id); // Throws NotFound if not found

    // 2. Check if media is still in use (using inverse relations counts)
    // This requires Prisma to be generated after adding inverse relations to Media model
    const usageCount = await this.prisma.$transaction(async (prisma) => {
      const products = await prisma.productImage.count({
        where: { imageId: id },
      });
      const productItems = await prisma.productItemImage.count({
        where: { imageId: id },
      });
      const categories = await prisma.category.count({
        where: { imageId: id },
      });
      const brands = await prisma.brand.count({ where: { logoId: id } });
      const users = await prisma.user.count({ where: { avatarId: id } });
      const banners = await prisma.banner.count({ where: { imageId: id } });
      return products + categories + brands + users + productItems + banners;
    });

    if (usageCount > 0) {
      throw new BadRequestException(
        `Media item "${media.filename}" cannot be deleted because it is still in use by ${usageCount} resource(s).`,
      );
    }

    // 3. Delete file from storage
    let s3Key: string | null = null;
    try {
      // Attempt to parse key from URL (adjust if your URL structure differs)
      const urlParts = new URL(media.url);
      s3Key = urlParts.pathname.startsWith('/')
        ? urlParts.pathname.substring(1)
        : urlParts.pathname; // Remove leading slash if present
      this._logger.log(`Attempting to delete S3 object with key: ${s3Key}`);

      await this.s3.deleteObject({
        Bucket: this.awsS3BucketName,
        Key: s3Key,
      });
      this._logger.log(`Deleted file from S3: ${s3Key}`);
    } catch (error) {
      // Log error but might proceed to delete DB record anyway, or handle differently
      this._logger.error(
        `Failed to delete file ${s3Key ?? 'unknown key'} from S3: ${error.message}. Corresponding DB record will still be deleted.`,
        error.stack,
      );
      // Depending on policy, you might choose to NOT delete the DB record if the file deletion fails
      // throw new InternalServerErrorException(`Could not delete file from storage. Aborting deletion.`);
    }

    // 4. Delete DB record
    try {
      await this.prisma.media.delete({ where: { id } });
      return {
        message: `Media item "${media.filename}" successfully deleted.`,
      };
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Media with ID "${id}" not found.`); // Should be caught earlier
      }
      this._logger.error(
        `Failed to delete media record ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Could not delete media record.');
    }
  }
}
