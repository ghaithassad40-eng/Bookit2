import { useState } from "react";
import { ExternalLink, Layers, Map as MapIcon, MapPin, Navigation, Phone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  appleMapsUrl,
  countryFlag,
  countryName,
  fullAddress,
  getLocation,
  googleDirectionsUrl,
  googleMapsEmbedUrl,
  googleMapsUrl,
  hasGoogleMapsKey,
  wazeUrl,
  type MapType,
} from "@/lib/location";
import type { BusinessRow } from "@/lib/database.types";

interface Props {
  business: BusinessRow;
  /** Compact variant used inside the invoice card. */
  compact?: boolean;
}

export function LocationCard({ business, compact = false }: Props) {
  const loc = getLocation(business);
  const [mapType, setMapType] = useState<MapType>("m");
  if (!loc) return null;

  const directions = googleDirectionsUrl(loc);
  const search = googleMapsUrl(loc, business.name);
  const apple = appleMapsUrl(loc, business.name);
  const waze = wazeUrl(loc);
  const embedUrl = googleMapsEmbedUrl(loc, { type: mapType, label: business.name });
  const showSatToggle = hasGoogleMapsKey() || true; // public embed also supports t=k

  return (
    <Card className={compact ? "overflow-hidden" : "overflow-hidden"}>
      {/* Map preview — Google Maps iframe (familiar UI, built-in pin + zoom + View Larger Map link) */}
      <div className={cn("relative", compact ? "aspect-[16/7]" : "aspect-[16/9]")}>
        <iframe
          key={mapType}
          title={`${business.name} on Google Maps`}
          src={embedUrl}
          className="h-full w-full border-0"
          loading="lazy"
          allow="geolocation; fullscreen"
          referrerPolicy="no-referrer-when-downgrade"
        />
        {showSatToggle && (
          <div className="pointer-events-none absolute right-3 top-3 flex items-center gap-1">
            <div className="pointer-events-auto inline-flex overflow-hidden rounded-lg border border-black/10 bg-white shadow-md">
              <button
                onClick={() => setMapType("m")}
                className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium transition-colors",
                  mapType === "m" ? "bg-black text-white" : "text-black/70 hover:bg-black/5",
                )}
                aria-pressed={mapType === "m"}
                aria-label="Standard map"
              >
                <MapIcon className="h-3 w-3" />
                Map
              </button>
              <button
                onClick={() => setMapType("k")}
                className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium transition-colors",
                  mapType === "k" ? "bg-black text-white" : "text-black/70 hover:bg-black/5",
                )}
                aria-pressed={mapType === "k"}
                aria-label="Satellite map"
              >
                <Layers className="h-3 w-3" />
                Satellite
              </button>
            </div>
          </div>
        )}
      </div>

      <CardContent className={`space-y-4 ${compact ? "p-4" : "p-5"}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Find us
            </div>
            <div className="mt-1.5 inline-flex items-start gap-2 text-sm">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <span className="font-medium leading-snug">{fullAddress(loc)}</span>
            </div>
            {business.country && (
              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span aria-hidden>{countryFlag(business.country)}</span>
                <span>{countryName(business.country)}</span>
                <span className="font-mono text-[10px] opacity-70">· {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}</span>
              </div>
            )}
            {business.phone && (
              <a
                href={`tel:${business.phone.replace(/\s+/g, "")}`}
                className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <Phone className="h-3.5 w-3.5" />
                {business.phone}
              </a>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild className="grow sm:grow-0">
            <a href={directions} target="_blank" rel="noopener noreferrer">
              <Navigation className="h-4 w-4" />
              Get directions
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href={search} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              Google Maps
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href={apple} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              Apple Maps
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href={waze} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              Waze
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
