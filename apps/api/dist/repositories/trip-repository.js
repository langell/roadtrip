export class TripRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    listByUser(userId) {
        return this.prisma.trip.findMany({
            where: { userId },
            include: { stops: { orderBy: { order: 'asc' } } }
        });
    }
    create(userId, input) {
        return this.prisma.trip.create({
            data: {
                userId,
                name: input.name,
                originLat: input.origin.lat,
                originLng: input.origin.lng,
                filters: input.filters,
                stops: {
                    create: input.stops.map((stop) => ({
                        placeId: stop.placeId,
                        name: stop.name,
                        order: stop.order,
                        lat: stop.location.lat,
                        lng: stop.location.lng,
                        notes: stop.notes
                    }))
                }
            },
            include: { stops: { orderBy: { order: 'asc' } } }
        });
    }
    update(userId, input) {
        return this.prisma.trip.update({
            where: { id: input.id, userId },
            data: {
                ...(input.name && { name: input.name }),
                ...(input.origin && {
                    originLat: input.origin.lat,
                    originLng: input.origin.lng
                }),
                ...(input.filters && { filters: input.filters })
            },
            include: { stops: { orderBy: { order: 'asc' } } }
        });
    }
}
