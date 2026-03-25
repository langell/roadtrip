import { z } from 'zod';
export declare const CoordinatesSchema: z.ZodObject<{
    lat: z.ZodNumber;
    lng: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    lat: number;
    lng: number;
}, {
    lat: number;
    lng: number;
}>;
export declare const TripStopSchema: z.ZodObject<{
    id: z.ZodString;
    placeId: z.ZodString;
    name: z.ZodString;
    location: z.ZodObject<{
        lat: z.ZodNumber;
        lng: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        lat: number;
        lng: number;
    }, {
        lat: number;
        lng: number;
    }>;
    notes: z.ZodOptional<z.ZodString>;
    order: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    id: string;
    placeId: string;
    name: string;
    location: {
        lat: number;
        lng: number;
    };
    order: number;
    notes?: string | undefined;
}, {
    id: string;
    placeId: string;
    name: string;
    location: {
        lat: number;
        lng: number;
    };
    order: number;
    notes?: string | undefined;
}>;
export declare const TripThemeSchema: z.ZodEnum<["scenic", "foodie", "culture", "adventure", "family"]>;
export declare const TripFiltersSchema: z.ZodObject<{
    radiusKm: z.ZodNumber;
    theme: z.ZodEnum<["scenic", "foodie", "culture", "adventure", "family"]>;
    maxStops: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    radiusKm: number;
    theme: "scenic" | "foodie" | "culture" | "adventure" | "family";
    maxStops: number;
}, {
    radiusKm: number;
    theme: "scenic" | "foodie" | "culture" | "adventure" | "family";
    maxStops: number;
}>;
export declare const TripSchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodString;
    name: z.ZodString;
    origin: z.ZodObject<{
        lat: z.ZodNumber;
        lng: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        lat: number;
        lng: number;
    }, {
        lat: number;
        lng: number;
    }>;
    stops: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        placeId: z.ZodString;
        name: z.ZodString;
        location: z.ZodObject<{
            lat: z.ZodNumber;
            lng: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            lat: number;
            lng: number;
        }, {
            lat: number;
            lng: number;
        }>;
        notes: z.ZodOptional<z.ZodString>;
        order: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        id: string;
        placeId: string;
        name: string;
        location: {
            lat: number;
            lng: number;
        };
        order: number;
        notes?: string | undefined;
    }, {
        id: string;
        placeId: string;
        name: string;
        location: {
            lat: number;
            lng: number;
        };
        order: number;
        notes?: string | undefined;
    }>, "many">;
    filters: z.ZodObject<{
        radiusKm: z.ZodNumber;
        theme: z.ZodEnum<["scenic", "foodie", "culture", "adventure", "family"]>;
        maxStops: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        radiusKm: number;
        theme: "scenic" | "foodie" | "culture" | "adventure" | "family";
        maxStops: number;
    }, {
        radiusKm: number;
        theme: "scenic" | "foodie" | "culture" | "adventure" | "family";
        maxStops: number;
    }>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    userId: string;
    origin: {
        lat: number;
        lng: number;
    };
    stops: {
        id: string;
        placeId: string;
        name: string;
        location: {
            lat: number;
            lng: number;
        };
        order: number;
        notes?: string | undefined;
    }[];
    filters: {
        radiusKm: number;
        theme: "scenic" | "foodie" | "culture" | "adventure" | "family";
        maxStops: number;
    };
    createdAt: string;
    updatedAt: string;
}, {
    id: string;
    name: string;
    userId: string;
    origin: {
        lat: number;
        lng: number;
    };
    stops: {
        id: string;
        placeId: string;
        name: string;
        location: {
            lat: number;
            lng: number;
        };
        order: number;
        notes?: string | undefined;
    }[];
    filters: {
        radiusKm: number;
        theme: "scenic" | "foodie" | "culture" | "adventure" | "family";
        maxStops: number;
    };
    createdAt: string;
    updatedAt: string;
}>;
export declare const TripCreateRequestSchema: z.ZodObject<Pick<{
    id: z.ZodString;
    userId: z.ZodString;
    name: z.ZodString;
    origin: z.ZodObject<{
        lat: z.ZodNumber;
        lng: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        lat: number;
        lng: number;
    }, {
        lat: number;
        lng: number;
    }>;
    stops: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        placeId: z.ZodString;
        name: z.ZodString;
        location: z.ZodObject<{
            lat: z.ZodNumber;
            lng: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            lat: number;
            lng: number;
        }, {
            lat: number;
            lng: number;
        }>;
        notes: z.ZodOptional<z.ZodString>;
        order: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        id: string;
        placeId: string;
        name: string;
        location: {
            lat: number;
            lng: number;
        };
        order: number;
        notes?: string | undefined;
    }, {
        id: string;
        placeId: string;
        name: string;
        location: {
            lat: number;
            lng: number;
        };
        order: number;
        notes?: string | undefined;
    }>, "many">;
    filters: z.ZodObject<{
        radiusKm: z.ZodNumber;
        theme: z.ZodEnum<["scenic", "foodie", "culture", "adventure", "family"]>;
        maxStops: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        radiusKm: number;
        theme: "scenic" | "foodie" | "culture" | "adventure" | "family";
        maxStops: number;
    }, {
        radiusKm: number;
        theme: "scenic" | "foodie" | "culture" | "adventure" | "family";
        maxStops: number;
    }>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "name" | "origin" | "stops" | "filters">, "strip", z.ZodTypeAny, {
    name: string;
    origin: {
        lat: number;
        lng: number;
    };
    stops: {
        id: string;
        placeId: string;
        name: string;
        location: {
            lat: number;
            lng: number;
        };
        order: number;
        notes?: string | undefined;
    }[];
    filters: {
        radiusKm: number;
        theme: "scenic" | "foodie" | "culture" | "adventure" | "family";
        maxStops: number;
    };
}, {
    name: string;
    origin: {
        lat: number;
        lng: number;
    };
    stops: {
        id: string;
        placeId: string;
        name: string;
        location: {
            lat: number;
            lng: number;
        };
        order: number;
        notes?: string | undefined;
    }[];
    filters: {
        radiusKm: number;
        theme: "scenic" | "foodie" | "culture" | "adventure" | "family";
        maxStops: number;
    };
}>;
export declare const TripUpdateRequestSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    origin: z.ZodOptional<z.ZodObject<{
        lat: z.ZodNumber;
        lng: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        lat: number;
        lng: number;
    }, {
        lat: number;
        lng: number;
    }>>;
    stops: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        placeId: z.ZodString;
        name: z.ZodString;
        location: z.ZodObject<{
            lat: z.ZodNumber;
            lng: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            lat: number;
            lng: number;
        }, {
            lat: number;
            lng: number;
        }>;
        notes: z.ZodOptional<z.ZodString>;
        order: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        id: string;
        placeId: string;
        name: string;
        location: {
            lat: number;
            lng: number;
        };
        order: number;
        notes?: string | undefined;
    }, {
        id: string;
        placeId: string;
        name: string;
        location: {
            lat: number;
            lng: number;
        };
        order: number;
        notes?: string | undefined;
    }>, "many">>;
    filters: z.ZodOptional<z.ZodObject<{
        radiusKm: z.ZodNumber;
        theme: z.ZodEnum<["scenic", "foodie", "culture", "adventure", "family"]>;
        maxStops: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        radiusKm: number;
        theme: "scenic" | "foodie" | "culture" | "adventure" | "family";
        maxStops: number;
    }, {
        radiusKm: number;
        theme: "scenic" | "foodie" | "culture" | "adventure" | "family";
        maxStops: number;
    }>>;
} & {
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    name?: string | undefined;
    origin?: {
        lat: number;
        lng: number;
    } | undefined;
    stops?: {
        id: string;
        placeId: string;
        name: string;
        location: {
            lat: number;
            lng: number;
        };
        order: number;
        notes?: string | undefined;
    }[] | undefined;
    filters?: {
        radiusKm: number;
        theme: "scenic" | "foodie" | "culture" | "adventure" | "family";
        maxStops: number;
    } | undefined;
}, {
    id: string;
    name?: string | undefined;
    origin?: {
        lat: number;
        lng: number;
    } | undefined;
    stops?: {
        id: string;
        placeId: string;
        name: string;
        location: {
            lat: number;
            lng: number;
        };
        order: number;
        notes?: string | undefined;
    }[] | undefined;
    filters?: {
        radiusKm: number;
        theme: "scenic" | "foodie" | "culture" | "adventure" | "family";
        maxStops: number;
    } | undefined;
}>;
export type Coordinates = z.infer<typeof CoordinatesSchema>;
export type TripStop = z.infer<typeof TripStopSchema>;
export type TripFilters = z.infer<typeof TripFiltersSchema>;
export type Trip = z.infer<typeof TripSchema>;
export type TripCreateRequest = z.infer<typeof TripCreateRequestSchema>;
export type TripUpdateRequest = z.infer<typeof TripUpdateRequestSchema>;
