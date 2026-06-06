import { MESSAGE_TYPES } from "./constants";

export type ClientFinderMessage =
  | {
      type: typeof MESSAGE_TYPES.setFilterEnabled;
      enabled: boolean;
    }
  | {
      type: typeof MESSAGE_TYPES.getFilterState;
    };

export type FilterStateResponse = {
  enabled: boolean;
};
