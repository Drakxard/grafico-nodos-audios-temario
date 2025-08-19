"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import * as d3 from "d3"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { attachAudioLayer } from "@/lib/audio"

interface Node extends d3.SimulationNodeDatum {
  id: string
  name: string
  group: string
  color: string
  startX?: number
  startY?: number
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

interface SubjectMap {
  nodes: Node[]
  links: Link[]
}

const SUBJECT_DATA: Record<string, { name: string; color: string }> = {
  algebra: { name: "Álgebra", color: "#3b82f6" },
  calculo: { name: "Cálculo", color: "#ef4444" },
  poo: { name: "Programación Orientada a Objetos", color: "#10b981" },
}

const INITIAL_SUBJECT_MAPS: Record<string, SubjectMap[]> = {
  algebra: [
    {
      nodes: [
        { id: "a1", name: "Álgebra Básica", group: "algebra", color: "#3b82f6" },
        { id: "a2", name: "Ecuaciones lineales", group: "algebra", color: "#3b82f6" },
        { id: "a3", name: "Polinomios", group: "algebra", color: "#3b82f6" },
      ],
      links: [
        { source: "a1", target: "a2" },
        { source: "a2", target: "a3" },
      ],
    },
  ],
  calculo: [
    {
      nodes: [
        { id: "c1", name: "Límites", group: "calculo", color: "#ef4444" },
        { id: "c2", name: "Derivadas", group: "calculo", color: "#ef4444" },
        { id: "c3", name: "Integrales", group: "calculo", color: "#ef4444" },
      ],
      links: [
        { source: "c1", target: "c2" },
        { source: "c2", target: "c3" },
      ],
    },
  ],
  poo: [
    {
      nodes: [
        { id: "p1", name: "Clases", group: "poo", color: "#10b981" },
        { id: "p2", name: "Objetos", group: "poo", color: "#10b981" },
        { id: "p3", name: "Herencia", group: "poo", color: "#10b981" },
      ],
      links: [
        { source: "p1", target: "p2" },
        { source: "p2", target: "p3" },
      ],
    },
  ],
}

const INITIAL_SUBJECT_GROUPS: Record<string, Group[]> = {
  algebra: [{ id: "algebra", name: "Álgebra", color: "#3b82f6" }],
  calculo: [{ id: "calculo", name: "Cálculo", color: "#ef4444" }],
  poo: [
    { id: "poo", name: "Programación Orientada a Objetos", color: "#10b981" },
  ],
}

const DEFAULT_WEEKS = [
  { id: "week1", name: "Semana 1" },
  { id: "week2", name: "Semana 2" },
]

export default function NetworkGraph() {
  const svgRef = useRef<SVGSVGElement>(null)
  const [nodes, setNodes] = useState<Node[]>([])
  const [links, setLinks] = useState<Link[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [currentGroup, setCurrentGroup] = useState<string>("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newNodeName, setNewNodeName] = useState("")
  const [showAllGroups, setShowAllGroups] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false)
  const [newGroupName, setNewGroupName] = useState("")
  const [nodePadding, setNodePadding] = useState(35)
  const audioLayerRef = useRef<ReturnType<typeof attachAudioLayer> | null>(null)
  const [folderReady, setFolderReady] = useState(false)
  const [weeks, setWeeks] = useState<{ id: string; name: string }[]>([])
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null)
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null)
  const weekSubjectMapsRef = useRef<
    Record<string, Record<string, SubjectMap[]>>
  >({})
  const weekSubjectGroupsRef = useRef<
    Record<string, Record<string, Group[]>>
  >({})
  const weekCurrentMapIndexRef = useRef<
    Record<string, Record<string, number>>
  >({})
  const [currentMapIndex, setCurrentMapIndex] = useState<Record<string, number>>(
    {},
  )
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(true)

  const DELETE_DISTANCE = 150

  const simulationRef = useRef<d3.Simulation<Node, Link> | null>(null)

  const randomColor = () =>
    "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0")
  const loadPersistedData = useCallback(() => {
    const storedWeeks = localStorage.getItem("weeks")
    const weeksData = storedWeeks ? JSON.parse(storedWeeks) : DEFAULT_WEEKS
    setWeeks(weeksData)
    weeksData.forEach((week: { id: string; name: string }) => {
      weekSubjectMapsRef.current[week.id] = {}
      weekSubjectGroupsRef.current[week.id] = {}
      weekCurrentMapIndexRef.current[week.id] = {}
      Object.keys(SUBJECT_DATA).forEach((subjectId) => {
        const maps =
          localStorage.getItem(`subjectMaps_${week.id}_${subjectId}`) || null
        weekSubjectMapsRef.current[week.id][subjectId] = maps
          ? JSON.parse(maps)
          : JSON.parse(JSON.stringify(INITIAL_SUBJECT_MAPS[subjectId]))

        const groups =
          localStorage.getItem(`subjectGroups_${week.id}_${subjectId}`) || null
        weekSubjectGroupsRef.current[week.id][subjectId] = groups
          ? JSON.parse(groups)
          : JSON.parse(JSON.stringify(INITIAL_SUBJECT_GROUPS[subjectId]))

        const index =
          localStorage.getItem(
            `currentMapIndex_${week.id}_${subjectId}`,
          ) || null
        weekCurrentMapIndexRef.current[week.id][subjectId] = index
          ? JSON.parse(index)
          : 0
      })
    })
  }, [])

  const addWeek = () => {
    const newNumber = weeks.length + 1
    const newWeek = { id: `week${Date.now()}`, name: `Semana ${newNumber}` }
    setWeeks((prev) => {
      const next = [...prev, newWeek]
      localStorage.setItem("weeks", JSON.stringify(next))
      return next
    })
    weekSubjectMapsRef.current[newWeek.id] = {}
    weekSubjectGroupsRef.current[newWeek.id] = {}
    weekCurrentMapIndexRef.current[newWeek.id] = {}
    Object.keys(SUBJECT_DATA).forEach((subjectId) => {
      weekSubjectMapsRef.current[newWeek.id][subjectId] = JSON.parse(
        JSON.stringify(INITIAL_SUBJECT_MAPS[subjectId]),
      )
      weekSubjectGroupsRef.current[newWeek.id][subjectId] = JSON.parse(
        JSON.stringify(INITIAL_SUBJECT_GROUPS[subjectId]),
      )
      weekCurrentMapIndexRef.current[newWeek.id][subjectId] = 0
      localStorage.setItem(
        `subjectMaps_${newWeek.id}_${subjectId}`,
        JSON.stringify(weekSubjectMapsRef.current[newWeek.id][subjectId]),
      )
      localStorage.setItem(
        `subjectGroups_${newWeek.id}_${subjectId}`,
        JSON.stringify(weekSubjectGroupsRef.current[newWeek.id][subjectId]),
      )
      localStorage.setItem(
        `currentMapIndex_${newWeek.id}_${subjectId}`,
        JSON.stringify(0),
      )
    })
  }

  const selectWeek = (id: string) => {
    setSelectedWeek(id)
    setCurrentMapIndex({ ...weekCurrentMapIndexRef.current[id] })
  }

  const saveCurrentSubjectData = useCallback(() => {
    if (!selectedWeek || !selectedSubject) return
    localStorage.setItem(
      `subjectMaps_${selectedWeek}_${selectedSubject}`,
      JSON.stringify(
        weekSubjectMapsRef.current[selectedWeek][selectedSubject],
      ),
    )
    localStorage.setItem(
      `subjectGroups_${selectedWeek}_${selectedSubject}`,
      JSON.stringify(
        weekSubjectGroupsRef.current[selectedWeek][selectedSubject],
      ),
    )
    localStorage.setItem(
      `currentMapIndex_${selectedWeek}_${selectedSubject}`,
      JSON.stringify(
        weekCurrentMapIndexRef.current[selectedWeek][selectedSubject],
      ),
    )
  }, [selectedWeek, selectedSubject])

  const selectSubject = (id: string) => {
    if (!selectedWeek) return
    const subject = SUBJECT_DATA[id]
    if (!subject) return
    setSelectedSubject(id)
    const maps = weekSubjectMapsRef.current[selectedWeek][id]
    const idx = currentMapIndex[id] ?? maps.length - 1
    const map = maps[idx]
    setNodes(map.nodes)
    setLinks(map.links)
    const g = weekSubjectGroupsRef.current[selectedWeek][id]
    setGroups(g)
    setCurrentGroup(g[0]?.id || "")
    setShowAllGroups(false)
    setIsConfigDialogOpen(false)
  }

  const handleBack = useCallback(() => {
    if (selectedSubject) {
      setSelectedSubject(null)
      setIsConfigDialogOpen(true)
    } else if (selectedWeek) {
      setSelectedWeek(null)
      setIsConfigDialogOpen(true)
    } else if (folderReady) {
      setFolderReady(false)
      setSelectedWeek(null)
      setSelectedSubject(null)
      setIsConfigDialogOpen(true)
    }
  }, [selectedSubject, selectedWeek, folderReady])

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

  const ensureAudioLayer = () => {
    if (!audioLayerRef.current && svgRef.current) {
      audioLayerRef.current = attachAudioLayer({
        nodesSelection: [],
        getExtId: () => "",
        rootElement: svgRef.current,
        options: { allowLocalFileSystem: true, autoSaveMetadata: true },
      })
    }
  }

  const handleFolderClick = async () => {
    ensureAudioLayer()
    const ok = await audioLayerRef.current?.requestFolderPermission()
    setFolderReady(!!ok)
    if (ok) {
      loadPersistedData()
    }
  }

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (weeks.length) {
      localStorage.setItem("weeks", JSON.stringify(weeks))
    }
  }, [weeks])

  useEffect(() => {
    if (selectedWeek && selectedSubject) {
      weekSubjectGroupsRef.current[selectedWeek][selectedSubject] = groups
      saveCurrentSubjectData()
    }
  }, [groups, selectedWeek, selectedSubject, saveCurrentSubjectData])

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

  const createNewMap = useCallback(() => {
    if (!selectedWeek || !selectedSubject) return
    const maps =
      weekSubjectMapsRef.current[selectedWeek][selectedSubject]
    maps.push({ nodes: [], links: [] })
    const newIndex = maps.length - 1
    weekCurrentMapIndexRef.current[selectedWeek][selectedSubject] = newIndex
    setCurrentMapIndex((prev) => ({ ...prev, [selectedSubject]: newIndex }))
    setNodes([])
    setLinks([])
    setNewNodeName("")
    saveCurrentSubjectData()
  }, [selectedWeek, selectedSubject, saveCurrentSubjectData])

  const goToPrevMap = useCallback(() => {
    if (!selectedWeek || !selectedSubject) return
    const idx = currentMapIndex[selectedSubject]
    if (idx <= 0) return
    const newIndex = idx - 1
    weekCurrentMapIndexRef.current[selectedWeek][selectedSubject] = newIndex
    setCurrentMapIndex((prev) => ({ ...prev, [selectedSubject]: newIndex }))
    const map =
      weekSubjectMapsRef.current[selectedWeek][selectedSubject][newIndex]
    setNodes(map.nodes)
    setLinks(map.links)
    saveCurrentSubjectData()
  }, [selectedWeek, selectedSubject, currentMapIndex, saveCurrentSubjectData])

  const addNode = useCallback(() => {
    if (!newNodeName.trim() || !currentGroup) return

    const groupData = groups.find((g) => g.id === currentGroup)
    if (!groupData) return

    const newNode: Node = {
      id: Date.now().toString(),
      name: newNodeName.trim(),
      group: currentGroup,
      color: groupData.color,
    }

    if (nodes.length === 0 && svgRef.current) {
      const { width, height } = svgRef.current.getBoundingClientRect()
      newNode.x = width / 2
      newNode.y = height / 2
    }

    const newLinks = nodes.map((n) => ({ source: newNode.id, target: n.id }))

    setNodes((prev) => [...prev, newNode])
    setLinks((prev) => [...prev, ...newLinks])
    setNewNodeName("")
    setIsDialogOpen(false)
    setShowAllGroups(false)
  }, [newNodeName, currentGroup, groups, nodes])

  useEffect(() => {
    if (!isMounted) return

    const handleKeyPress = (event: KeyboardEvent) => {
      switch (event.key) {
        case "ArrowRight":
          event.preventDefault()
          createNewMap()
          break
        case "ArrowLeft":
          event.preventDefault()
          goToPrevMap()
          break
        case "+":
          event.preventDefault()
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
          }
          break
      }
    }

    window.addEventListener("keydown", handleKeyPress)
    return () => window.removeEventListener("keydown", handleKeyPress)
  }, [createNewMap, goToPrevMap, isMounted])

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
        .on("start", function (event, d) {
          if (!event.active && simulation) simulation.alphaTarget(0.3).restart()
          d.fx = d.x
          d.fy = d.y
          d.startX = d.x
          d.startY = d.y
        })
        .on("drag", function (event, d) {
          d.fx = event.x
          d.fy = event.y
          const dx = event.x - (d.startX ?? 0)
          const dy = event.y - (d.startY ?? 0)
          const dist = Math.sqrt(dx * dx + dy * dy)
          const progress = Math.min(dist / DELETE_DISTANCE, 1)
          const newColor = d3.interpolateRgb(d.color, "#ff0000")(progress)
          d3.select(this).attr("fill", newColor)
        })
        .on("end", function (event, d) {
          if (!event.active && simulation) simulation.alphaTarget(0)
          d.fx = null
          d.fy = null
          const dx = (event.x ?? d.x!) - (d.startX ?? 0)
          const dy = (event.y ?? d.y!) - (d.startY ?? 0)
          const dist = Math.sqrt(dx * dx + dy * dy)
          d3.select(this).attr("fill", d.color)
          if (dist > DELETE_DISTANCE) {
            setNodes((prev) => prev.filter((n) => n.id !== d.id))
            setLinks((prev) =>
              prev.filter((l) => {
                const sourceId =
                  typeof l.source === "string" ? l.source : l.source.id
                const targetId =
                  typeof l.target === "string" ? l.target : l.target.id
                return sourceId !== d.id && targetId !== d.id
              }),
            )
          }
        }),
    )

    audioLayerRef.current?.dispose()
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

  useEffect(() => {
    if (!selectedWeek || !selectedSubject) return
    const idx = currentMapIndex[selectedSubject]
    weekSubjectMapsRef.current[selectedWeek][selectedSubject][idx] = {
      nodes,
      links,
    }
    weekCurrentMapIndexRef.current[selectedWeek][selectedSubject] = idx
    saveCurrentSubjectData()
  }, [
    nodes,
    links,
    currentMapIndex,
    selectedWeek,
    selectedSubject,
    saveCurrentSubjectData,
  ])

  if (!isMounted) {
    return <div className="w-full h-screen bg-gray-50 dark:bg-gray-900" />
  }

  return (
    <div className="w-full h-screen bg-gray-50 dark:bg-gray-900 relative overflow-hidden">
      <svg ref={svgRef} width="100%" height="100%" className="bg-gray-50 dark:bg-gray-900" />
      {folderReady && (
        <Button
          className="absolute top-4 left-4 z-[60]"
          variant="outline"
          onClick={handleBack}
        >
          ←
        </Button>
      )}

      <Dialog open={isConfigDialogOpen} onOpenChange={setIsConfigDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {!folderReady
                ? "Configura carpeta"
                : !selectedWeek
                ? "Selecciona semana"
                : "Selecciona materia"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Button onClick={handleFolderClick} className="w-full">
              {folderReady ? "Carpeta lista" : "Cargar carpeta local"}
            </Button>
            {folderReady && !selectedWeek && (
              <div className="grid gap-2">
                {weeks.map((w) => (
                  <Button
                    key={w.id}
                    variant="outline"
                    onClick={() => selectWeek(w.id)}
                  >
                    {w.name}
                  </Button>
                ))}
                <Button variant="outline" onClick={addWeek}>
                  +
                </Button>
              </div>
            )}
            {folderReady && selectedWeek && !selectedSubject && (
              <div className="grid gap-2">
                {Object.entries(SUBJECT_DATA).map(([id, data]) => (
                  <Button
                    key={id}
                    variant="outline"
                    onClick={() => selectSubject(id)}
                  >
                    {data.name}
                  </Button>
                ))}
              </div>
            )}
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
