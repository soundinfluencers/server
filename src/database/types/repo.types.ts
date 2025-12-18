import {ClientSession} from "mongoose";

export interface RepoOptions {
    lean?: boolean;
    session?: ClientSession;

    // TODO: add other options
    // populate?: PopulateOptions | PopulateOptions[];
    // collation?: any;
    // maxTimeMS?: number;
}