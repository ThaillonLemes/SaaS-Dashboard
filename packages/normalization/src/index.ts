export type { ErpMapper } from './mapper';

export {
  validate as validateProduct,
  type CanonicalProduct,
} from './entities/product';

export {
  validate as validateCustomer,
  type CanonicalCustomer,
} from './entities/customer';

export {
  validate as validateOrder,
  type CanonicalOrder,
  type CanonicalOrderStatus,
} from './entities/order';

export type { RawPayload } from '@saas/contracts';
