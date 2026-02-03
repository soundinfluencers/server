import {ClientSession} from "mongoose";

export interface RepoOptions {
    lean?: boolean;
    session?: ClientSession;
    limit?: number;
    skip?: number;
    sort?: Record<string, 1 | -1>;

    // TODO: add other options
    // populate?: PopulateOptions | PopulateOptions[];
    // collation?: any;
    // maxTimeMS?: number;
}