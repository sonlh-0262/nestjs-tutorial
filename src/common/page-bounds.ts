import {
  DEFAULT_PAGE_LIMIT,
  DEFAULT_PAGE_OFFSET,
} from './constants/pagination';
import { PaginationQueryDto } from './dto/pagination-query.dto';

export function pageBounds(query: PaginationQueryDto): {
  take: number;
  skip: number;
} {
  return {
    take: query.limit ?? DEFAULT_PAGE_LIMIT,
    skip: query.offset ?? DEFAULT_PAGE_OFFSET,
  };
}
