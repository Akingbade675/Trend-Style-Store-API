import { SearchResponse } from '@elastic/elasticsearch/lib/api/types';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { OnEvent } from '@nestjs/event-emitter';
import { Prisma, Product } from '@prisma/client';
import { FindProductsDto } from 'src/products/dto/find-products.dto';
import {
  ProductCreatedEvent,
  ProductDeletedEvent,
  ProductUpdatedEvent,
  ProductUpdatedPayload, // Now Partial<ProductCreatedPayload>
} from 'src/products/events/product';
import { ProductSearchDocument } from './interfaces/product-search.interface';

// Type alias for the full payload (matching ProductCreatedPayload definition)
// Used by indexProduct and handleProductCreatedEvent
type FullProductPayload = Prisma.ProductGetPayload<{
  include: {
    brand: { select: { id: true; name: true } };
    categories: { select: { category: { select: { id: true; name: true } } } };
    tags: { select: { tag: { select: { id: true; name: true } } } };
    attributes: { select: { value: true } };
    items: { select: { sku: true } };
    images: { where: { isPrimary: true }; take: 1; select: { image: { select: { url: true } } } };
  };
}>;

// Alias for the event's partial payload type
type PartialProductPayload = ProductUpdatedPayload;

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private readonly index: string;

  constructor(
    private readonly elasticsearch: ElasticsearchService,
    private readonly configService: ConfigService,
  ) {
    this.index = this.configService.getOrThrow('ELASTICSEARCH_PRODUCT_INDEX');
    this.ensureIndexExists();
  }

  @OnEvent('product.created')
  async handleProductCreatedEvent(event: ProductCreatedEvent) {
    this.logger.log(`Received product.created event for ID: ${event.product.id}`);
    // Ensure indexProduct receives the correct full payload type
    await this.indexProduct(event.product as FullProductPayload);
  }

  @OnEvent('product.updated')
  async handleProductUpdatedEvent(event: ProductUpdatedEvent) {
    this.logger.log(`Received product.updated event for ID: ${event.product.id}`);
    if (!event.product.id) {
      this.logger.error('Product update event missing product ID.');
      return;
    }

    const partialDoc = this._mapPartialPayloadToPartialSearchDoc(event.product);

    // If mapping resulted in no fields to update (besides ID), skip ES update
    if (Object.keys(partialDoc).length === 0) {
      this.logger.verbose(`No relevant fields to update in Elasticsearch for product ${event.product.id}. Skipping.`);
      return;
    }

    try {
      await this.elasticsearch.update({
        index: this.index,
        id: event.product.id,
        doc: partialDoc,
      });
      this.logger.verbose(`Partially updated product ${event.product.id} in Elasticsearch.`);
    } catch (error) {
      // Handle specific errors like 'document_missing_exception'
      if (error.statusCode === 404) {
        this.logger.warn(`Product ${event.product.id} not found in Elasticsearch for update. Attempting full index.`);
        // Fallback: try to index the document fully if possible (requires full payload)
        // This part is tricky as the event only *might* have the full payload currently.
        // For now, just log the warning.
        // TODO: Implement a strategy for handling missing documents during updates, potentially requiring a full fetch.
      } else {
        this.logger.error(`Failed to partially update product ${event.product.id}: ${error.message}`, error.stack);
      }
    }
  }

  @OnEvent('product.deleted')
  async handleProductDeletedEvent(event: ProductDeletedEvent) {
    this.logger.log(`Received product.deleted event for ID: ${event.productId}`);
    await this.deleteProduct(event.productId);
  }

  private async ensureIndexExists(): Promise<void> {
    try {
      const exists = await this.elasticsearch.indices.exists({ index: this.index });
      if (!exists) {
        this.logger.warn(`Elasticsearch index "${this.index}" not found. Creating...`);
        await this.elasticsearch.indices.create({
          index: this.index,
          // Optional: Define explicit mappings here for better control
          settings: {
            analysis: {
              analyzer: {
                default: {
                  type: 'custom',
                  tokenizer: 'standard',
                },
              },
              tokenizer: {
                n_gram_tokenizer: {
                  type: 'edge_ngram',
                  min_gram: 1,
                  max_gram: 30,
                  token_chars: ['letter', 'digit'],
                },
              },
            },
          },
        });
        this.logger.log(`Elasticsearch index "${this.index}" created.`);
      }
    } catch (error) {
      this.logger.error(`Failed to check/create Elasticsearch index "${this.index}": ${error.message}`, error.stack);
      // Decide how to handle this: retry? fail startup?
    }
  }

  // --- Indexing Methods ---

  async indexProduct(product: FullProductPayload): Promise<void> {
    const searchDoc = this.mapProductToSearchDocument(product);
    try {
      await this.elasticsearch.index({
        index: this.index,
        id: product.id,
        document: searchDoc,
        refresh: true, // Make changes visible quickly for consistency
      });
      this.logger.verbose(`Indexed product ${product.id} - ${product.name}`);
    } catch (error) {
      this.logger.error(`Failed to index product ${product.id}: ${error.message}`, error.stack);
    }
  }

  async bulkIndexProducts(products: FullProductPayload[]): Promise<void> {
    if (products.length === 0) return;

    const operations = products.flatMap((product) => [
      { index: { _index: this.index, _id: product.id } },
      this.mapProductToSearchDocument(product),
    ]);

    try {
      const bulkResponse = await this.elasticsearch.bulk({ refresh: true, operations });
      if (bulkResponse.errors) {
        const erroredDocuments = [];
        bulkResponse.items.forEach((action, i) => {
          if (action.index?.error) {
            erroredDocuments.push({
              id: products[i].id,
              error: action.index.error,
            });
          }
        });
        this.logger.error('Errors occurred during bulk indexing:', erroredDocuments);
      } else {
        this.logger.log(`Successfully bulk indexed ${products.length} products.`);
      }
    } catch (error) {
      this.logger.error(`Failed to bulk index products: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Could not perform bulk indexing.');
    }
  }

  async deleteProduct(productId: string): Promise<void> {
    try {
      await this.elasticsearch.delete({
        index: this.index,
        id: productId,
      });
      this.logger.verbose(`Deleted product ${productId} from index`);
    } catch (error) {
      if (error.statusCode === 404) {
        this.logger.warn(`Product ${productId} not found in index for deletion.`);
        return; // Ignore not found errors on delete
      }
      this.logger.error(`Failed to delete product ${productId} from index: ${error.message}`, error.stack);
    }
  }

  async deleteAllProducts(): Promise<void> {
    try {
      await this.elasticsearch.deleteByQuery({
        index: this.index,
        query: { match_all: {} },
        refresh: true, // Ensure deletion is reflected
      });
      this.logger.log(`Deleted all documents from index "${this.index}".`);
    } catch (error) {
      this.logger.error(`Failed to delete all documents from index "${this.index}": ${error.message}`, error.stack);
      throw new InternalServerErrorException('Could not clear search index.');
    }
  }

  // --- Search Method ---

  async searchProducts(queryDto: FindProductsDto): Promise<{ data: Product[]; count: number }> {
    const { page, limit, skip, search, categoryId, brandId, tags, minPrice, maxPrice, isFeatured, isActive, sortBy } =
      queryDto;

    const query_dsl: any = {
      bool: {
        must: [], // For text search
        filter: [], // For exact match/range filters
      },
    };

    // Text Search using multi_match
    if (search) {
      query_dsl.bool.must.push({
        multi_match: {
          query: search,
          fields: ['name^3', 'description', 'brandName', 'categoryNames', 'tagNames', 'itemSkus^2', 'attributeValues'], // Boost name and SKU
          fuzziness: 'AUTO', // Allow for typos
          operator: 'and', // Require all terms (more precise) or "or" (broader)
        },
      });
    } else {
      query_dsl.bool.must.push({ match_all: {} }); // Match all if no search term
    }

    // --- Filters ---
    // Note: Filters now use indexed ID fields
    if (brandId) {
      // Assuming brandId was indexed, otherwise use brandName.term
      // This requires mapping brandId during indexing or using brandName
      // For now, let's assume we search by brandName if brandId is passed
      // Fetch brand name from DB based on brandId? Simpler: Expect client to filter by name?
      // Let's filter by brandName if possible during indexing
      // query_dsl.bool.filter.push({ term: { 'brandName.keyword': 'Brand Name From ID' } });
      query_dsl.bool.filter.push({ term: { brandId: brandId } });
    }
    if (categoryId) {
      // Product must belong to this category
      query_dsl.bool.filter.push({ term: { categoryIds: categoryId } });
    }
    if (tags && tags.length > 0) {
      // Product must have all specified tags? Use 'terms' for 'any of'
      // Assuming 'any of':
      query_dsl.bool.filter.push({ terms: { tagIds: tags } });
    }
    if (minPrice !== undefined || maxPrice !== undefined) {
      const rangeQuery: any = {};
      if (minPrice !== undefined) rangeQuery.gte = minPrice;
      if (maxPrice !== undefined) rangeQuery.lte = maxPrice;
      query_dsl.bool.filter.push({ range: { salePrice: rangeQuery } });
    }
    if (isFeatured !== undefined) {
      query_dsl.bool.filter.push({ term: { isFeatured: isFeatured } });
    }
    if (isActive !== undefined) {
      query_dsl.bool.filter.push({ term: { isActive: isActive } });
    }

    // --- Sorting ---
    const sort: any[] = [];
    switch (sortBy) {
      case 'price_asc':
        sort.push({ salePrice: 'asc' });
        break;
      case 'price_desc':
        sort.push({ salePrice: 'desc' });
        break;
      case 'name_asc':
        sort.push({ 'name.keyword': 'asc' });
        break; // Use .keyword for exact sorting on text
      case 'name_desc':
        sort.push({ 'name.keyword': 'desc' });
        break;
      case 'createdAt_asc':
        sort.push({ createdAt: 'asc' });
        break;
      case 'createdAt_desc':
      default:
        sort.push({ createdAt: 'desc' });
        break;
    }
    // Add score for relevance when searching
    if (search) {
      sort.unshift({ _score: 'desc' });
    }

    try {
      const result: SearchResponse<ProductSearchDocument> = await this.elasticsearch.search<ProductSearchDocument>({
        index: this.index,
        from: skip,
        size: limit,
        query: query_dsl,
        sort: sort,
      });

      const totalCount = typeof result.hits.total === 'number' ? result.hits.total : (result.hits.total?.value ?? 0);
      const productIds = result.hits.hits.map((hit) => hit._id); // Extract IDs
      let products = [];
      result.hits.hits.forEach((hit) => products.push(hit._source));

      //   return { ids: productIds, count: totalCount };
      return { count: totalCount, data: products };
    } catch (error) {
      this.logger.error(`Elasticsearch search failed: ${error.message}`, error.stack);
      // Handle specific ES errors if needed (e.g., index not found, query parsing error)
      throw new InternalServerErrorException('Could not perform product search.');
    }
  }

  // --- Helper to map Full Prisma Product to ES Document ---
  private mapProductToSearchDocument(product: FullProductPayload): ProductSearchDocument {
    return {
      id: product.id,
      name: product.name,
      description: product.description ?? null,
      slug: product.slug ?? null,
      isActive: product.isActive,
      isFeatured: product.isFeatured,
      originalPrice: product.originalPrice,
      salePrice: product.salePrice,
      skuPrefix: product.skuPrefix ?? null,
      brandName: product.brand?.name ?? null,
      brandId: product.brand?.id ?? null,
      categoryNames: product.categories?.map((pc) => pc.category.name) ?? [],
      categoryIds: product.categories?.map((pc) => pc.category.id) ?? [],
      tagNames: product.tags?.map((pt) => pt.tag.name) ?? [],
      tagIds: product.tags?.map((pt) => pt.tag.id) ?? [],
      attributeValues: product.attributes?.map((pa) => pa.value) ?? [],
      itemSkus: product.items?.map((pi) => pi.sku).filter((sku): sku is string => sku !== null) ?? [],
      imageUrl: product.images?.[0]?.image?.url ?? null,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  // --- Helper to map Partial Event Payload to Partial ES Document ---
  private _mapPartialPayloadToPartialSearchDoc(payload: PartialProductPayload): Partial<ProductSearchDocument> {
    const partialDoc: Partial<ProductSearchDocument> = {};

    // Map only fields present in the partial payload
    if (payload.name !== undefined) partialDoc.name = payload.name;
    if (payload.description !== undefined) partialDoc.description = payload.description;
    if (payload.slug !== undefined) partialDoc.slug = payload.slug;
    if (payload.isActive !== undefined) partialDoc.isActive = payload.isActive;
    if (payload.isFeatured !== undefined) partialDoc.isFeatured = payload.isFeatured;
    if (payload.originalPrice !== undefined) partialDoc.originalPrice = payload.originalPrice;
    if (payload.salePrice !== undefined) partialDoc.salePrice = payload.salePrice;
    if (payload.skuPrefix !== undefined) partialDoc.skuPrefix = payload.skuPrefix;
    if (payload.updatedAt !== undefined) partialDoc.updatedAt = payload.updatedAt; // Important for sorting/filtering

    // Handle relations (only if present in payload)
    if (payload.brand !== undefined) {
      partialDoc.brandId = payload.brand?.id ?? null;
      partialDoc.brandName = payload.brand?.name ?? null;
    }
    if (payload.categories !== undefined) {
      partialDoc.categoryIds = payload.categories?.map((pc) => pc.category.id) ?? [];
      partialDoc.categoryNames = payload.categories?.map((pc) => pc.category.name) ?? [];
    }
    if (payload.tags !== undefined) {
      partialDoc.tagIds = payload.tags?.map((pt) => pt.tag.id) ?? [];
      partialDoc.tagNames = payload.tags?.map((pt) => pt.tag.name) ?? [];
    }
    if (payload.attributes !== undefined) {
      partialDoc.attributeValues = payload.attributes?.map((pa) => pa.value) ?? [];
    }
    if (payload.items !== undefined) {
      // Ensure null SKUs are filtered out and type is correct
      partialDoc.itemSkus = payload.items?.map((pi) => pi.sku).filter((sku): sku is string => sku !== null) ?? [];
    }
    if (payload.images !== undefined) {
      // Assumes the payload.images (if present) follows the same logic: primary first
      partialDoc.imageUrl = payload.images?.[0]?.image?.url ?? null;
    }

    return partialDoc;
  }
}
