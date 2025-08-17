"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import * as d3 from "d3"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"

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
  { id: "technology", name: "Tecnología", color: "#3b82f6" },
  { id: "business", name: "Negocios", color: "#ef4444" },
  { id: "science", name: "Ciencia", color: "#10b981" },
  { id: "arts", name: "Arte", color: "#f59e0b" },
  { id: "sports", name: "Deportes", color: "#8b5cf6" },
]

const INITIAL_NODES: Node[] = [
  { id: "1", name: "React", group: "technology", color: "#3b82f6" },
  { id: "2", name: "Node.js", group: "technology", color: "#3b82f6" },
  { id: "3", name: "Marketing", group: "business", color: "#ef4444" },
  { id: "4", name: "Ventas", group: "business", color: "#ef4444" },
  { id: "5", name: "Física", group: "science", color: "#10b981" },
  { id: "6", name: "Química", group: "science", color: "#10b981" },
]

const INITIAL_LINKS: Link[] = [
  { source: "1", target: "2" },
  { source: "3", target: "4" },
  { source: "5", target: "6" },
]

export default function NetworkGraph() {
  const svgRef = useRef<SVGSVGElement>(null)
  const [groups, setGroups] = useState<Group[]>(INITIAL_GROUPS)
  const [nodes, setNodes] = useState<Node[]>(INITIAL_NODES)
  const [links, setLinks] = useState<Link[]>(INITIAL_LINKS)
  const [currentGroup, setCurrentGroup] = useState<string>(INITIAL_GROUPS[0].id)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false)
  const [newNodeName, setNewNodeName] = useState("")
  const [newNodeGroup, setNewNodeGroup] = useState("")
  const [newGroupName, setNewGroupName] = useState("")
  const [newGroupColor, setNewGroupColor] = useState("#000000")
  const [showAllGroups, setShowAllGroups] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  const simulationRef = useRef<d3.Simulation<Node, Link> | null>(null)

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

    const existingGroupNodes = nodes.filter((n) => n.group === newNodeGroup)
    const newLinks: Link[] = existingGroupNodes.map((n) => ({ source: newNode.id, target: n.id }))

    setNodes((prev) => [...prev, newNode])
    if (newLinks.length > 0) {
      setLinks((prev) => [...prev, ...newLinks])
    }
    setNewNodeName("")
    setNewNodeGroup("")
    setIsDialogOpen(false)
    setCurrentGroup(newNodeGroup)
    setShowAllGroups(false)
  }, [newNodeName, newNodeGroup, nodes, groups])

  const addGroup = useCallback(() => {
    if (!newGroupName.trim()) return
    const id = newGroupName.trim().toLowerCase().replace(/\s+/g, "-")
    const newGroup: Group = { id, name: newGroupName.trim(), color: newGroupColor }
    setGroups((prev) => [...prev, newGroup])
    setNewGroupName("")
    setNewGroupColor("#000000")
  }, [newGroupName, newGroupColor])

  const deleteGroup = useCallback(
    (id: string) => {
      setGroups((prev) => prev.filter((g) => g.id !== id))
      setNodes((prev) => prev.filter((n) => n.group !== id))
      if (currentGroup === id && groups.length > 0) {
        const next = groups.find((g) => g.id !== id)
        if (next) setCurrentGroup(next.id)
      }
    },
    [currentGroup, groups],
  )

  const updateGroupName = useCallback((id: string, name: string) => {
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, name } : g)))
  }, [])

  useEffect(() => {
    if (!isMounted) return

    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLowerCase() === "n") {
        event.preventDefault()
        setIsGroupDialogOpen(true)
        return
      }
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
      }
    }

    window.addEventListener("keydown", handleKeyPress)
    return () => window.removeEventListener("keydown", handleKeyPress)
  }, [navigateToGroup, currentGroup, isMounted])

  useEffect(() => {
    if (!isMounted || !svgRef.current) return

    const svgElement = svgRef.current
    const svg = d3.select(svgElement)

    const width = typeof window !== "undefined" ? window.innerWidth : 800
    const height = typeof window !== "undefined" ? window.innerHeight : 600

    const container = svg.append("g").attr("class", "zoom-container")

    svg.call(
      d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 4])
        .on("zoom", (event) => {
          container.attr("transform", event.transform)
        }),
    )

    container.append("g").attr("class", "links")
    container.append("g").attr("class", "nodes")
    container.append("g").attr("class", "labels")

    simulationRef.current = d3
      .forceSimulation<Node, Link>()
      .force("link", d3.forceLink<Node, Link>().id((d) => d.id).distance(100).strength(0.5))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(35))

    return () => {
      simulationRef.current?.stop()
      simulationRef.current?.on("tick", null)
      simulationRef.current = null
      svg.selectAll("*").remove()
    }
  }, [isMounted])

  useEffect(() => {
    if (!isMounted || !svgRef.current || !simulationRef.current) return

    const svg = d3.select(svgRef.current)
    const container = svg.select<SVGGElement>("g.zoom-container")
    const linksGroup = container.select<SVGGElement>("g.links")
    const nodesGroup = container.select<SVGGElement>("g.nodes")
    const labelsGroup = container.select<SVGGElement>("g.labels")

    const nodesData = getVisibleNodes()
    const linksData = getVisibleLinks()

    const linkSelection = linksGroup
      .selectAll<SVGLineElement, Link>("line")
      .data(linksData, (d: any) => {
        const s = typeof d.source === "string" ? d.source : d.source.id
        const t = typeof d.target === "string" ? d.target : d.target.id
        return `${s}-${t}`
      })

    linkSelection
      .enter()
      .append("line")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", 2)

    linkSelection.exit().remove()

    const nodeSelection = nodesGroup
      .selectAll<SVGCircleElement, Node>("circle")
      .data(nodesData, (d) => d.id)

    const nodeEnter = nodeSelection
      .enter()
      .append("circle")
      .attr("r", 20)
      .attr("fill", (d) => d.color)
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .style("cursor", "pointer")
      .call(
        d3
          .drag<SVGCircleElement, Node>()
          .on("start", (event, d) => {
            if (!event.active) simulationRef.current!.alphaTarget(0.3).restart()
            d.fx = d.x
            d.fy = d.y
          })
          .on("drag", (event, d) => {
            d.fx = event.x
            d.fy = event.y
          })
          .on("end", (event, d) => {
            if (!event.active) simulationRef.current!.alphaTarget(0)
            d.fx = null
            d.fy = null
          }),
      )

    nodeSelection.exit().remove()

    const mergedNodes = nodeEnter.merge(nodeSelection)

    const labelSelection = labelsGroup
      .selectAll<SVGTextElement, Node>("text")
      .data(nodesData, (d) => d.id)

    const labelEnter = labelSelection
      .enter()
      .append("text")
      .attr("font-size", 12)
      .attr("font-family", "sans-serif")
      .attr("text-anchor", "middle")
      .attr("fill", "#fff")
      .attr("pointer-events", "none")

    labelSelection.exit().remove()

    const mergedLabels = labelEnter.merge(labelSelection)
    mergedLabels.text((d) => d.name)

    const simulation = simulationRef.current
    simulation.nodes(nodesData)
    ;(simulation.force("link") as d3.ForceLink<Node, Link>).links(linksData)

    simulation.on("tick", () => {
      linksGroup
        .selectAll<SVGLineElement, Link>("line")
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

      mergedNodes.attr("cx", (d) => d.x || 0).attr("cy", (d) => d.y || 0)

      mergedLabels.attr("x", (d) => d.x || 0).attr("y", (d) => (d.y || 0) + 30)
    })

    simulation.alpha(0.5).restart()
  }, [getVisibleNodes, getVisibleLinks, isMounted])

  if (!isMounted) {
    return <div className="w-full h-screen bg-gray-50 dark:bg-gray-900" />
  }

  return (
    <div className="w-full h-screen bg-gray-50 dark:bg-gray-900 relative overflow-hidden">
      <svg ref={svgRef} width="100%" height="100%" className="bg-gray-50 dark:bg-gray-900" />

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
              <div key={group.id} className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: group.color }} />
                <Input value={group.name} onChange={(e) => updateGroupName(group.id, e.target.value)} />
                <Button variant="destructive" size="sm" onClick={() => deleteGroup(group.id)}>
                  Eliminar
                </Button>
              </div>
            ))}
            <div className="flex items-center gap-2 pt-4">
              <Input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Nueva categoría"
              />
              <Input
                type="color"
                value={newGroupColor}
                onChange={(e) => setNewGroupColor(e.target.value)}
                className="w-12 p-0"
              />
              <Button onClick={addGroup}>Agregar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
