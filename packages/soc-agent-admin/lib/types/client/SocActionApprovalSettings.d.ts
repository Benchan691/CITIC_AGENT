export interface SocAction {
    name: string;
    group: string;
    label: string;
    kind?: 'read' | 'mutation' | 'ui-confirmed';
}
export declare function validCatalog(value: unknown): SocAction[];
