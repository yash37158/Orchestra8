// A simplified version of topojson for our needs
const topojson = {
  feature: (topology: any, object: any) => {
    // This is a simplified version that just returns the object
    // In a real implementation, this would convert TopoJSON to GeoJSON
    return {
      type: "FeatureCollection",
      features: object.geometries.map((geometry: any) => {
        return {
          type: "Feature",
          properties: geometry.properties,
          geometry: {
            type: geometry.type,
            coordinates: geometry.coordinates,
          },
        }
      }),
    }
  },
}

export default topojson
