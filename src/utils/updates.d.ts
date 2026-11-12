export declare const RELEASES_API = "https://api.github.com/repos/CDocc/KnackeredTV/releases?per_page=20";
export declare const RELEASES_PAGE = "https://github.com/CDocc/KnackeredTV/releases";
export interface ReleaseInfo {
    version: string;
    tag: string;
    name: string;
    notes: string;
    url: string;
    date: string;
}
export interface UpdateCheck {
    current: string;
    latest: string | null;
    updateAvailable: boolean;
    /** Releases newer than the running version, newest first */
    newer: ReleaseInfo[];
    /** Notes for the running version, when it has a published release */
    currentRelease: ReleaseInfo | null;
    error?: string;
}
/** Negative when a < b, positive when a > b, 0 when equal; null when either side is not a version. */
export declare function compareVersions(a: string, b: string): number | null;
/** Keeps the changelog part of a release body and drops the download instructions. */
export declare function releaseNotes(body: string | null | undefined): string;
export declare function parseReleases(json: any): ReleaseInfo[];
export declare function evaluate(current: string, releases: ReleaseInfo[]): UpdateCheck;
export declare function checkForUpdates(current: string): Promise<UpdateCheck>;
//# sourceMappingURL=updates.d.ts.map