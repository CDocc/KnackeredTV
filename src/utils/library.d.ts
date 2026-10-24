export interface Library {
    live: any[];
    movie: any[];
    series: any[];
}
export declare const getCachedLibrary: (profileId: string) => Library;
export declare const getLibrary: (profile: any) => Promise<Library>;
export declare const searchList: (items: any[], query: string) => any[];
//# sourceMappingURL=library.d.ts.map