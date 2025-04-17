// Global variable to store our project data
let projectData = null;

// Load data from JSON file
async function loadData() {
    try {
        const response = await fetch('big_picture_brief.json');
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        projectData = await response.json();
        
        // Once data is loaded, initialize the chord diagram
        createChordDiagram();
        
        // Setup event listeners
        document.getElementById('reset-button').addEventListener('click', () => {
            createChordDiagram('all');
        });
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

// Process the data to create nodes and links
const processData = () => {
    // Extract unique categories, applications, and methods
    const categories = new Set();
    const applications = new Set();
    const methods = new Set();
    const nodeTypes = {};
    const links = [];

    projectData.solutions.forEach(solution => {
        // Add category
        categories.add(solution.category);
        nodeTypes[solution.category] = 'category';
        
        // Add application
        applications.add(solution.application);
        nodeTypes[solution.application] = 'application';
        
        // Method handling - check if it's an array or a string that needs to be split
        let methodsArray = Array.isArray(solution.method) ? 
            solution.method : solution.method.split(', ');
        
        methodsArray.forEach(method => {
            // Trim any whitespace from the method name
            method = method.trim();
            methods.add(method);
            nodeTypes[method] = 'method';
            
            // Create links between nodes - only from category to application and category to method
            links.push({
                source: solution.category,
                target: solution.application,
                project: solution.category
            });
            
            // Link from category directly to method
            links.push({
                source: solution.category,
                target: method,
                project: solution.category
            });
        });
    });

    // Convert to arrays and combine in the desired order: categories, then applications, then methods
    const categoryNodes = Array.from(categories);
    const applicationNodes = Array.from(applications);
    const methodNodes = Array.from(methods);
    
    // Combine all nodes in the proper grouping order
    const nodes = [...categoryNodes, ...applicationNodes, ...methodNodes];
    
    // Create mapping of node names to indices
    const nodeIndices = {};
    nodes.forEach((node, i) => {
        nodeIndices[node] = i;
    });
    
    console.log("Nodes organized by type:", nodes);
    
    // Create matrix for chord diagram
    const matrix = Array(nodes.length).fill().map(() => Array(nodes.length).fill(0));
    
    links.forEach(link => {
        const sourceIndex = nodeIndices[link.source];
        const targetIndex = nodeIndices[link.target];
        
        // Increment values in the matrix for both directions to create symmetric matrix
        matrix[sourceIndex][targetIndex] += 1;
        matrix[targetIndex][sourceIndex] += 1;
    });
    
    return {
        nodes,
        nodeTypes,
        nodeIndices,
        matrix,
        links,
        // Include the counts for later reference
        counts: {
            categories: categoryNodes.length,
            applications: applicationNodes.length,
            methods: methodNodes.length
        }
    };
};

// Create data-based gradient for chords
const createGradients = (svg, chords, colors, nodeIndices, innerRadius) => {
    const grads = svg.append("defs").selectAll("linearGradient")
        .data(chords)
        .enter().append("linearGradient")
        .attr("id", d => `chordGradient-${d.source.index}-${d.target.index}`)
        .attr("gradientUnits", "userSpaceOnUse")
        .attr("x1", d => innerRadius * Math.cos((d.source.endAngle - d.source.startAngle) / 2 + d.source.startAngle - Math.PI / 2))
        .attr("y1", d => innerRadius * Math.sin((d.source.endAngle - d.source.startAngle) / 2 + d.source.startAngle - Math.PI / 2))
        .attr("x2", d => innerRadius * Math.cos((d.target.endAngle - d.target.startAngle) / 2 + d.target.startAngle - Math.PI / 2))
        .attr("y2", d => innerRadius * Math.sin((d.target.endAngle - d.target.startAngle) / 2 + d.target.startAngle - Math.PI / 2));

    // Set the starting color (at 0%)
    grads.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", d => colors[d.source.index]);

    // Set the ending color (at 100%)
    grads.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", d => colors[d.target.index]);
};

// Function to highlight connections to a specific node
const highlightConnections = (nodeName) => {
    // Clear previous diagram
    d3.select("#chord-diagram").html("");
    
    // Process data
    const { nodes, nodeTypes, nodeIndices, matrix, links, counts } = processData();
    
    // Set up dimensions
    const width = 700;
    const height = 600;
    const outerRadius = Math.min(width, height) * 0.5 - 60;
    const innerRadius = outerRadius - 20;
    
    // Create SVG
    const svg = d3.select("#chord-diagram")
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${width / 2}, ${height / 2})`);
    
    // Create chord layout
    const chord = d3.chord()
        .padAngle(0.05)
        .sortSubgroups(d3.descending)
        .sortChords(d3.descending);
    
    // Disable sorting of groups to maintain our grouping by type
    chord.sortGroups(null);
    
    const chords = chord(matrix);
    
    // Create color scale based on node types
    const colorScale = d => {
        const nodeType = nodeTypes[nodes[d.index]];
        if (nodeType === 'category') return "#8dd3c7";
        if (nodeType === 'application') return "#fb8072";
        if (nodeType === 'method') return "#80b1d3";
        return "#ccc";
    };
    
    // Array of colors for each node (needed for gradients)
    const colors = nodes.map((node, i) => {
        const nodeType = nodeTypes[node];
        if (nodeType === 'category') return "#8dd3c7";
        if (nodeType === 'application') return "#fb8072";
        if (nodeType === 'method') return "#80b1d3";
        return "#ccc";
    });
    
    // Create gradients for chords
    createGradients(svg, chords, colors, nodeIndices, innerRadius);
    
    // Draw the outer arcs (groups)
    const arcGroup = svg.selectAll(".arc")
        .data(chords.groups)
        .enter().append("g")
        .attr("class", "arc");
    
    const arc = d3.arc()
        .innerRadius(innerRadius)
        .outerRadius(outerRadius);
    
    arcGroup.append("path")
        .attr("d", arc)
        .attr("class", d => `node-${nodeTypes[nodes[d.index]]}`)
        .style("stroke", "#fff")
        .style("stroke-width", 2)
        .style("cursor", "pointer")
        .on("click", function(event, d) {
            const clickedNodeName = nodes[d.index];
            const nodeType = nodeTypes[clickedNodeName];
            
            if (nodeType === 'category') {
                // For category nodes, show the project view
                // If already selected, reset to all projects view
                if (nodeName === clickedNodeName) {
                    createChordDiagram('all');
                } else {
                    createChordDiagram(clickedNodeName);
                }
            } else {
                // For application and method nodes
                if (nodeName === clickedNodeName) {
                    // If clicking the same node again, reset to all projects
                    createChordDiagram('all');
                } else {
                    // Otherwise, highlight the clicked node's connections
                    highlightConnections(clickedNodeName);
                }
            }
        })
        .on("mouseover", function(event, d) {
            d3.select(this).style("opacity", 0.7);
        })
        .on("mouseout", function(event, d) {
            d3.select(this).style("opacity", 1);
        });
    
    // Add labels to arcs
    arcGroup.append("text")
        .each(d => { d.angle = (d.startAngle + d.endAngle) / 2; })
        .attr("dy", ".35em")
        .attr("class", "node-text")
        .attr("transform", d => {
            return `rotate(${d.angle * 180 / Math.PI - 90})
                translate(${outerRadius + 10})
                ${d.angle > Math.PI ? "rotate(180)" : ""}`;
        })
        .attr("text-anchor", d => d.angle > Math.PI ? "end" : "start")
        .text(d => {
            const nodeText = nodes[d.index];
            // Truncate long names
            return nodeText.length > 25 ? nodeText.substring(0, 22) + '...' : nodeText;
        });
    
    // Draw the chords
    const ribbon = d3.ribbon()
        .radius(innerRadius);
    
    const chordPaths = svg.selectAll(".chord")
        .data(chords)
        .enter().append("path")
        .attr("class", "chord")
        .attr("d", ribbon)
        .style("fill", d => `url(#chordGradient-${d.source.index}-${d.target.index})`)
        .style("stroke", "#fff")
        .style("stroke-width", 0.5);
    
    // Find the node's index
    const selectedNodeIndex = nodeIndices[nodeName];
    
    // Highlight only chords connected to the selected node
    chordPaths.classed("faded", d => {
        return d.source.index !== selectedNodeIndex && d.target.index !== selectedNodeIndex;
    });
    
    // Also fade arc groups that aren't the selected node or connected to it
    arcGroup.classed("faded", d => {
        // The selected node itself should not be faded
        if (d.index === selectedNodeIndex) return false;
        
        // Check if this node is connected to the selected node in the matrix
        return matrix[d.index][selectedNodeIndex] === 0;
    });
    
    // Hide the impact panel when highlighting non-category nodes
    if (nodeTypes[nodeName] !== 'category') {
        document.getElementById('impact-panel').classList.add('hidden');
    } else {
        // For category nodes, show the impact panel
        const impactPanel = document.getElementById('impact-panel');
        impactPanel.classList.remove('hidden');
        
        // Find the impact for the selected project
        const project = projectData.solutions.find(sol => sol.category === nodeName);
        if (project) {
            document.getElementById('impact-text').textContent = project.impact;
        }
    }
};

// Function to create and update the chord diagram
const createChordDiagram = (selectedProject = 'all') => {
    // Clear previous diagram
    d3.select("#chord-diagram").html("");
    
    // Process data
    const { nodes, nodeTypes, nodeIndices, matrix, links, counts } = processData();
    
    // Set up dimensions
    const width = 700;
    const height = 600;
    const outerRadius = Math.min(width, height) * 0.5 - 60;
    const innerRadius = outerRadius - 20;
    
    // Create SVG
    const svg = d3.select("#chord-diagram")
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${width / 2}, ${height / 2})`);
    
    // Create chord layout
    const chord = d3.chord()
        .padAngle(0.05)
        .sortSubgroups(d3.descending)
        .sortChords(d3.descending);
    
    // Disable sorting of groups to maintain our grouping by type
    chord.sortGroups(null);
    
    const chords = chord(matrix);
    
    // Log node type boundaries for debugging
    console.log("Categories:", 0, "to", counts.categories - 1);
    console.log("Applications:", counts.categories, "to", counts.categories + counts.applications - 1);
    console.log("Methods:", counts.categories + counts.applications, "to", nodes.length - 1);
    
    // Create color scale based on node types
    const colorScale = d => {
        const nodeType = nodeTypes[nodes[d.index]];
        if (nodeType === 'category') return "#8dd3c7";
        if (nodeType === 'application') return "#fb8072";
        if (nodeType === 'method') return "#80b1d3";
        return "#ccc";
    };
    
    // Array of colors for each node (needed for gradients)
    const colors = nodes.map((node, i) => {
        const nodeType = nodeTypes[node];
        if (nodeType === 'category') return "#8dd3c7";
        if (nodeType === 'application') return "#fb8072";
        if (nodeType === 'method') return "#80b1d3";
        return "#ccc";
    });
    
    // Create gradients for chords
    createGradients(svg, chords, colors, nodeIndices, innerRadius);
    
    // Draw the outer arcs (groups)
    const arcGroup = svg.selectAll(".arc")
        .data(chords.groups)
        .enter().append("g")
        .attr("class", "arc");
    
    const arc = d3.arc()
        .innerRadius(innerRadius)
        .outerRadius(outerRadius);
    
    arcGroup.append("path")
        .attr("d", arc)
        .attr("class", d => `node-${nodeTypes[nodes[d.index]]}`)
        .style("stroke", "#fff")
        .style("stroke-width", 2)
        .style("cursor", "pointer")  // Make all nodes clickable
        .on("click", function(event, d) {
            const nodeName = nodes[d.index];
            const nodeType = nodeTypes[nodeName];
            
            if (nodeType === 'category') {
                // For category nodes, show the project view
                // If already selected, reset to all projects view
                if (selectedProject === nodeName) {
                    createChordDiagram('all');
                } else {
                    createChordDiagram(nodeName);
                }
            } else {
                // For application and method nodes, highlight related projects
                // Find all projects that use this application or method
                const relatedProjects = links.filter(link => 
                    link.source === nodeName || link.target === nodeName
                ).map(link => link.project);
                
                // If only one related project, show that project
                if (relatedProjects.length === 1) {
                    createChordDiagram(relatedProjects[0]);
                } else if (selectedProject !== nodeName) {
                    // Otherwise, highlight all connections to this node
                    // We'll use the node name as the selectedProject to track state
                    highlightConnections(nodeName);
                } else {
                    // If the same node is clicked again, reset to all projects
                    createChordDiagram('all');
                }
            }
        })
        .on("mouseover", function(event, d) {
            // Highlight on hover for all nodes when in all projects view
            if (selectedProject === 'all') {
                d3.select(this).style("opacity", 0.7);
            }
        })
        .on("mouseout", function(event, d) {
            // Reset opacity on mouseout
            if (selectedProject === 'all') {
                d3.select(this).style("opacity", 1);
            }
        });
    
    // Add labels to arcs
    arcGroup.append("text")
        .each(d => { d.angle = (d.startAngle + d.endAngle) / 2; })
        .attr("dy", ".35em")
        .attr("class", "node-text")
        .attr("transform", d => {
            return `rotate(${d.angle * 180 / Math.PI - 90})
                translate(${outerRadius + 10})
                ${d.angle > Math.PI ? "rotate(180)" : ""}`;
        })
        .attr("text-anchor", d => d.angle > Math.PI ? "end" : "start")
        .text(d => {
            const nodeName = nodes[d.index];
            // Truncate long names
            return nodeName.length > 25 ? nodeName.substring(0, 22) + '...' : nodeName;
        });
    
    // Draw the chords
    const ribbon = d3.ribbon()
        .radius(innerRadius);
    
    const chordPaths = svg.selectAll(".chord")
        .data(chords)
        .enter().append("path")
        .attr("class", "chord")
        .attr("d", ribbon)
        .style("fill", d => `url(#chordGradient-${d.source.index}-${d.target.index})`)
        .style("stroke", "#fff")
        .style("stroke-width", 0.5);
    
    // If a specific project is selected, highlight only its chords
    if (selectedProject !== 'all') {
        chordPaths.classed("faded", d => {
            const sourceNode = nodes[d.source.index];
            const targetNode = nodes[d.target.index];
            
            // Check if this chord is related to the selected project
            const isRelevant = links.some(link => 
                link.project === selectedProject && 
                ((link.source === sourceNode && link.target === targetNode) || 
                 (link.source === targetNode && link.target === sourceNode))
            );
            
            return !isRelevant;
        });
        
        // Also fade arc groups that aren't part of this project
        arcGroup.classed("faded", d => {
            const nodeName = nodes[d.index];
            
            // Check if this node is related to the selected project
            const isRelevant = links.some(link => 
                link.project === selectedProject && 
                (link.source === nodeName || link.target === nodeName)
            );
            
            return !isRelevant;
        });
        
        // Show the impact panel
        const impactPanel = document.getElementById('impact-panel');
        impactPanel.classList.remove('hidden');
        
        // Find the impact for the selected project
        const project = projectData.solutions.find(sol => sol.category === selectedProject);
        if (project) {
            document.getElementById('impact-text').textContent = project.impact;
        }
    } else {
        // Hide the impact panel for "All Projects" view
        document.getElementById('impact-panel').classList.add('hidden');
        
        // Remove any fading from previous selections
        arcGroup.classed("faded", false);
    }
};

// Initialize when the DOM is ready
document.addEventListener('DOMContentLoaded', loadData);


