"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import * as d3 from "d3"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { attachAudioLayer } from "@/lib/audio"

interface Node extends d3.SimulationNodeDatum {
  id: string
  name: string
  group: string
  color: string
}

interface Link extends d3.SimulationLinkDatum<Node> {
  source: string | Node
  target: string | Node
}

interface Group {
  id: string
  name: string
  color: string
}

const INITIAL_GROUPS: Group[] = [
  { id: "algebra", name: "Álgebra", color: "#3b82f6" },
  { id: "calculo", name: "Cálculo", color: "#ef4444" },
  { id: "poo", name: "Programación Orientada a Objetos", color: "#10b981" },
]

const INITIAL_NODES: Node[] = [
  { id: "1", name: "Matrices", group: "algebra", color: "#3b82f6" },
  { id: "2", name: "Ecuaciones", group: "algebra", color: "#3b82f6" },
  { id: "3", name: "Derivadas", group: "calculo", color: "#ef4444" },
  { id: "4", name: "Integrales", group: "calculo", color: "#ef4444" },
  { id: "5", name: "Clases", group: "poo", color: "#10b981" },
  { id: "6", name: "Herencia", group: "poo", color: "#10b981" },
]

const INITIAL_LINKS: Link[] = [
  { source: "1", target: "2" },
  { source: "3", target: "4" },
  { source: "5", target: "6" },
]

export default function NetworkGraph() {
  const svgRef = useRef<SVGSVGElement>(null)
  const [nodes, setNodes] = useState<Node[]>(INITIAL_NODES)
  const [links, setLinks] = useState<Link[]>(INITIAL_LINKS)
  const [groups, setGroups] = useState<Group[]>(INITIAL_GROUPS)
  const [currentGroup, setCurrentGroup] = useState<string>(INITIAL_GROUPS[0].id)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newNodeName, setNewNodeName] = useState("")
  const [newNodeGroup, setNewNodeGroup] = useState("")
  const [showAllGroups, setShowAllGroups] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false)
  const [newGroupName, setNewGroupName] = useState("")
  const [nodePadding, setNodePadding] = useState(35)
  const audioLayerRef = useRef<ReturnType<typeof attachAudioLayer> | null>(null)
  const [folderReady, setFolderReady] = useState(false)
  const [isSubjectDialogOpen, setIsSubjectDialogOpen] = useState(true)

  const simulationRef = useRef<d3.Simulation<Node, Link> | null>(null)

  const randomColor = () =>
    "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0")

  const deleteGroup = (id: string) => {
    const nextGroups = groups.filter((g) => g.id !== id)
    const remainingNodeIds = new Set(
      nodes.filter((n) => n.group !== id).map((n) => n.id),
    )
    setGroups(nextGroups)
    setNodes((prev) => prev.filter((n) => n.group !== id))
    setLinks((prev) =>
      prev.filter((l) => {
        const sourceId = typeof l.source === "string" ? l.source : l.source.id
        const targetId = typeof l.target === "string" ? l.target : l.target.id
        return remainingNodeIds.has(sourceId) && remainingNodeIds.has(targetId)
      }),
    )
    if (currentGroup === id) {
      setCurrentGroup(nextGroups[0]?.id || "")
    }
  }

  const handleFolderClick = async () => {
    const ok = await audioLayerRef.current?.requestFolderPermission()
    setFolderReady(!!ok)
  }

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const getVisibleNodes = useCallback(() => {
    if (showAllGroups) {
      return nodes
    }
    return nodes.filter((node) => node.group === currentGroup)
  }, [nodes, currentGroup, showAllGroups])

  const getVisibleLinks = useCallback(() => {
    const visibleNodeIds = new Set(getVisibleNodes().map((n) => n.id))
    return links.filter((link) => {
      const sourceId = typeof link.source === "string" ? link.source : link.source.id
      const targetId = typeof link.target === "string" ? link.target : link.target.id
      return visibleNodeIds.has(sourceId) && visibleNodeIds.has(targetId)
    })
  }, [links, getVisibleNodes])

  const navigateToGroup = useCallback(
    (direction: "next" | "prev") => {
      const currentIndex = groups.findIndex((g) => g.id === currentGroup)
      if (currentIndex === -1 || groups.length === 0) return
      let newIndex

      if (direction === "next") {
        newIndex = (currentIndex + 1) % groups.length
      } else {
        newIndex = currentIndex === 0 ? groups.length - 1 : currentIndex - 1
      }

      setCurrentGroup(groups[newIndex].id)
      setShowAllGroups(false)
    },
    [currentGroup, groups],
  )

  const addNode = useCallback(() => {
    if (!newNodeName.trim() || !newNodeGroup) return

    const groupData = groups.find((g) => g.id === newNodeGroup)
    if (!groupData) return

    const newNode: Node = {
      id: Date.now().toString(),
      name: newNodeName.trim(),
      group: newNodeGroup,
      color: groupData.color,
    }

    const targetNodes = nodes.filter((n) => n.group === newNodeGroup)
    const newLinks = targetNodes.map((n) => ({ source: newNode.id, target: n.id }))

    setNodes((prev) => [...prev, newNode])
    setLinks((prev) => [...prev, ...newLinks])
    setNewNodeName("")
    setNewNodeGroup("")
    setIsDialogOpen(false)
    setCurrentGroup(newNodeGroup)
    setShowAllGroups(false)
  }, [newNodeName, newNodeGroup, groups, nodes])

  useEffect(() => {
    if (!isMounted) return

    const handleKeyPress = (event: KeyboardEvent) => {
      switch (event.key) {
        case "ArrowRight":
          event.preventDefault()
          navigateToGroup("next")
          break
        case "ArrowLeft":
          event.preventDefault()
          navigateToGroup("prev")
          break
        case "+":
          event.preventDefault()
          setNewNodeGroup(currentGroup)
          setIsDialogOpen(true)
          break
        case "Home":
          event.preventDefault()
          setShowAllGroups(true)
          break
        case "i":
        case "I":
          if (event.ctrlKey) {
            event.preventDefault()
            event.stopPropagation()
            setIsGroupDialogOpen(true)
            setNodePadding((p) => p + 5)
          }
          break
      }
    }

    window.addEventListener("keydown", handleKeyPress)
    return () => window.removeEventListener("keydown", handleKeyPress)
  }, [navigateToGroup, currentGroup, isMounted])

  useEffect(() => {
    if (!isMounted || !svgRef.current) {
      console.log("[v0] SVG ref not ready, skipping D3 initialization")
      return
    }

    const svgElement = svgRef.current
    const svg = d3.select(svgElement)

    const width = typeof window !== "undefined" ? window.innerWidth : 800
    const height = typeof window !== "undefined" ? window.innerHeight : 600

    svg.selectAll("*").remove()

      const visibleNodes = getVisibleNodes()
      const visibleLinks = getVisibleLinks()

      if (visibleNodes.length === 0) {
        console.log("[v0] No visible nodes, skipping graph creation")
        return
      }

      const nodesCopy = visibleNodes
      const linksCopy = visibleLinks

    if (simulationRef.current) {
      simulationRef.current.stop()
      simulationRef.current.on("tick", null) // Remove old tick handler
      simulationRef.current = null
    }

    console.log("[v0] Creating D3 simulation with", nodesCopy.length, "nodes")

    const simulation = d3
      .forceSimulation(nodesCopy)
      .force(
        "link",
        d3
          .forceLink<Node, Link>(linksCopy)
          .id((d) => d.id)
          .distance(100)
          .strength(0.5),
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(nodePadding))

    simulationRef.current = simulation

    const container = svg.append("g").attr("class", "zoom-container")

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        if (container.node()) {
          container.attr("transform", event.transform)
        }
      })

    svg.call(zoom)

    const linksGroup = container.append("g").attr("class", "links")
    const linkElements = linksGroup
      .selectAll("line")
      .data(linksCopy)
      .enter()
      .append("line")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", 2)

    const nodesGroup = container.append("g").attr("class", "nodes")
    const nodeElements = nodesGroup
      .selectAll("circle")
      .data(nodesCopy)
      .enter()
      .append("circle")
      .attr("r", 20)
      .attr("fill", (d) => d.color)
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .style("cursor", "pointer")

    nodeElements.call(
      d3
        .drag<SVGCircleElement, Node>()
        .on("start", (event, d) => {
          if (!event.active && simulation) simulation.alphaTarget(0.3).restart()
          d.fx = d.x
          d.fy = d.y
        })
        .on("drag", (event, d) => {
          d.fx = event.x
          d.fy = event.y
        })
        .on("end", (event, d) => {
          if (!event.active && simulation) simulation.alphaTarget(0)
          d.fx = null
          d.fy = null
        }),
    )

    const audioLayer = attachAudioLayer({
      nodesSelection: nodeElements.nodes(),
      getExtId: (el) => (el as any).__data__.id,
      rootElement: svgElement,
      options: { allowLocalFileSystem: true, autoSaveMetadata: true },
    })
    audioLayerRef.current = audioLayer
    setFolderReady(audioLayer.hasFolderAccess())

    const labelsGroup = container.append("g").attr("class", "labels")
      const labelElements = labelsGroup
        .selectAll("text")
        .data(nodesCopy)
        .enter()
        .append("text")
        .text((d) => d.name)
        .attr("font-size", 12)
        .attr("font-family", "sans-serif")
        .attr("text-anchor", "middle")
        .attr("fill", (d) => d.color)
        .attr("pointer-events", "none")

    simulation.on("tick", () => {
      // Check if elements still exist and are valid DOM nodes
      const linkNodes = linkElements.nodes()
      const nodeNodes = nodeElements.nodes()
      const labelNodes = labelElements.nodes()

      if (!linkNodes.length || !nodeNodes.length || !labelNodes.length) {
        console.log("[v0] Elements not available during tick, stopping simulation")
        simulation.stop()
        return
      }

      const isValidDomNode = (el: unknown): el is Element =>
        !!el && typeof (el as Element).nodeName === "string"

      if (!linkNodes.every(isValidDomNode)) {
        console.log("[v0] Invalid link elements detected, stopping simulation")
        simulation.stop()
        return
      }

      if (!nodeNodes.every(isValidDomNode)) {
        console.log("[v0] Invalid node elements detected, stopping simulation")
        simulation.stop()
        return
      }

      if (!labelNodes.every(isValidDomNode)) {
        console.log("[v0] Invalid label elements detected, stopping simulation")
        simulation.stop()
        return
      }

      try {
        linkElements
          .attr("x1", (d) => {
            const source = d.source as Node
            return source.x || 0
          })
          .attr("y1", (d) => {
            const source = d.source as Node
            return source.y || 0
          })
          .attr("x2", (d) => {
            const target = d.target as Node
            return target.x || 0
          })
          .attr("y2", (d) => {
            const target = d.target as Node
            return target.y || 0
          })

          nodeElements.attr("cx", (d) => d.x || 0).attr("cy", (d) => d.y || 0)

          labelElements
            .attr("x", (d) => d.x || 0)
            .attr("y", (d) => (d.y || 0) + 30)
      } catch (error) {
        console.log("[v0] Error during tick update, stopping simulation:", error)
        simulation.stop()
      }
    })

    setTimeout(() => simulation.stop(), 1000)

    console.log("[v0] D3 graph initialized successfully")

    return () => {
      audioLayer.dispose()
      console.log("[v0] Cleaning up D3 simulation")
      if (simulationRef.current) {
        simulationRef.current.stop()
        simulationRef.current.on("tick", null)
        simulationRef.current = null
      }
    }
  }, [getVisibleNodes, getVisibleLinks, isMounted, nodePadding])

  if (!isMounted) {
    return <div className="w-full h-screen bg-gray-50 dark:bg-gray-900" />
  }

  return (
    <div className="w-full h-screen bg-gray-50 dark:bg-gray-900 relative overflow-hidden">
      <svg ref={svgRef} width="100%" height="100%" className="bg-gray-50 dark:bg-gray-900" />

      <Dialog open={isSubjectDialogOpen} onOpenChange={setIsSubjectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Selecciona materia</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Button onClick={handleFolderClick} className="w-full">
              {folderReady ? "Carpeta lista" : "Cargar carpeta local"}
            </Button>
            <div className="grid gap-2">
              {groups.map((group) => (
                <Button
                  key={group.id}
                  onClick={() => {
                    setCurrentGroup(group.id)
                    setIsSubjectDialogOpen(false)
                  }}
                >
                  {group.name}
                </Button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar Nuevo Nodo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="nodeName">Nombre del nodo</Label>
              <Input
                id="nodeName"
                value={newNodeName}
                onChange={(e) => setNewNodeName(e.target.value)}
                placeholder="Ingresa el nombre del nodo"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    addNode()
                  }
                }}
              />
            </div>
            <div>
              <Label htmlFor="nodeGroup">Grupo</Label>
              <Select value={newNodeGroup} onValueChange={setNewNodeGroup}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un grupo" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: group.color }} />
                        {group.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={addNode} className="w-full">
              Agregar Nodo
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isGroupDialogOpen} onOpenChange={setIsGroupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Categorías</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {groups.map((group) => (
              <div key={group.id} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    value={group.name}
                    onChange={(e) =>
                      setGroups((prev) =>
                        prev.map((g) =>
                          g.id === group.id ? { ...g, name: e.target.value } : g,
                        ),
                      )
                    }
                  />
                  <Button
                    variant="destructive"
                    onClick={() => deleteGroup(group.id)}
                  >
                    Eliminar
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {nodes
                    .filter((n) => n.group === group.id)
                    .map((n) => (
                      <span
                        key={n.id}
                        className="px-2 py-1 bg-gray-200 rounded text-xs dark:bg-gray-800"
                      >
                        {n.name}
                      </span>
                    ))}
                </div>
              </div>
            ))}
            <div className="flex items-center gap-2 pt-2">
              <Input
                placeholder="Nueva categoría"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
              />
              <Button
                onClick={() => {
                  if (!newGroupName.trim()) return
                  const id =
                    newGroupName
                      .trim()
                      .toLowerCase()
                      .replace(/\s+/g, "-") + Date.now()
                  setGroups([
                    ...groups,
                    { id, name: newGroupName.trim(), color: randomColor() },
                  ])
                  setNewGroupName("")
                }}
              >
                Agregar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
