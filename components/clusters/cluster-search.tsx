"use client"

import { useState } from "react"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

// Mock data for search
const searchItems = [
  {
    id: "aws-us-east-1",
    name: "AWS US East",
    type: "cloud",
    provider: "AWS",
  },
  {
    id: "aws-eu-west-1",
    name: "AWS EU West",
    type: "cloud",
    provider: "AWS",
  },
  {
    id: "gcp-us-central1",
    name: "GCP US Central",
    type: "cloud",
    provider: "GCP",
  },
  {
    id: "edge-mumbai",
    name: "Edge Mumbai",
    type: "edge",
    provider: "Edge",
  },
  {
    id: "edge-berlin",
    name: "Edge Berlin",
    type: "edge",
    provider: "Edge",
  },
  {
    id: "edge-london",
    name: "Edge London",
    type: "edge",
    provider: "Edge",
  },
]

export function ClusterSearch() {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-[250px] justify-start" onClick={() => setOpen(true)}>
          <Search className="mr-2 h-4 w-4" />
          <span>Search clusters and nodes...</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" align="start">
        <Command>
          <CommandInput placeholder="Search clusters and nodes..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Cloud Providers">
              {searchItems
                .filter((item) => item.type === "cloud")
                .map((item) => (
                  <CommandItem key={item.id}>
                    <div className="flex items-center">
                      <span
                        className="mr-2 h-2 w-2 rounded-full"
                        style={{
                          backgroundColor: item.provider === "AWS" ? "#FF9900" : "#4285F4",
                        }}
                      />
                      {item.name}
                    </div>
                  </CommandItem>
                ))}
            </CommandGroup>
            <CommandGroup heading="Edge Nodes">
              {searchItems
                .filter((item) => item.type === "edge")
                .map((item) => (
                  <CommandItem key={item.id}>
                    <div className="flex items-center">
                      <span className="mr-2 h-2 w-2 rounded-full bg-blue-500" />
                      {item.name}
                    </div>
                  </CommandItem>
                ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
