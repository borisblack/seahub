import { PRIVATE_COLUMN_KEY } from './private';

export const NOT_DISPLAY_COLUMN_KEYS = [
  PRIVATE_COLUMN_KEY.ID,
  PRIVATE_COLUMN_KEY.CTIME,
  PRIVATE_COLUMN_KEY.MTIME,
  PRIVATE_COLUMN_KEY.CREATOR,
  PRIVATE_COLUMN_KEY.LAST_MODIFIER,
];

export const VIEW_NOT_DISPLAY_COLUMN_KEYS = [
  PRIVATE_COLUMN_KEY.IS_DIR,
];