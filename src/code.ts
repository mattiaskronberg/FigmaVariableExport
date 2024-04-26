

// This shows the HTML page in "ui.html".
figma.showUI(__html__);
figma.ui.resize(400, 240);


// Loads the different variable collections and returns them to the UI
async function populateCheckboxes() {
  const variablesPromise = figma.variables.getLocalVariableCollectionsAsync();
  var result = (await variablesPromise).map(variable => ({ id: variable.id, name: variable.name }));

  if (result.length > 0)
    figma.ui.postMessage({ type: "variableCollectionsFound", data: result });
  else
    figma.ui.postMessage({ type: "noCollectionFound", data: null });

};

// Method for messages from the UI
figma.ui.onmessage = msg => {
  if (msg.type === 'export-selected-collections') {
    if (msg.selectedCollections.length != 0) {
      exportSelectedCollections(msg.selectedCollections);
    }
  }
};

// Method for when the plugin starts running
figma.on("run", () => {
  populateCheckboxes();
});

// Exports the selected collections
/**
 * Exports the selected variable collections.
 * @param selectedCollections - An array of collection names to export.
 */
async function exportSelectedCollections(selectedCollections: string[]) {
  
  var collectionsToExport: { name: string, variables: string[] }[] = [];

  const allVariableCollections = await figma.variables.getLocalVariableCollectionsAsync();

  // Loop through all variables collections and process the selected ones
  for (const collection of allVariableCollections) {
    // Check if collection was selected
    if (isInCollection(collection, selectedCollections)) {
      var modes = collection.modes;
      var ids = collection.variableIds;

      // Loop through the modes in the collection
      for (const m of modes) {
        const modeName = m.name;
        var variables: string[] = [];

        // Loop through the variables in the collection
        for (const id of ids) {
          // Get the specific variable
          var v = await figma.variables.getVariableByIdAsync(id);
          if (v != null) {
            // Get the string values for the variables
            var value = await getVariableString(v, m);
            variables.push(`"${v.name}" : "${value}"`); // Corrected the quotation mark at the end
          }
        }

        var result = { name: `${collection.name}-${modeName}`, variables };
        collectionsToExport.push(result);
      }
    }
  }

  figma.ui.postMessage({ type: "collectionsReady", data: collectionsToExport });
}

async function getVariableString(v: Variable, mode: { name: string, modeId: string }) : Promise<string> {
  var value = v.valuesByMode[mode.modeId];
  const converted = await variableToString(value, v.resolvedType);
  console.log("Everything is converted now. The variable name is " + v.name + " and the value is " + converted);
  return converted as string;

}


async function variableToString(v: VariableValue, resolvedType: VariableResolvedDataType) {

  // Is this check needed?
  if (v !== undefined && ["COLOR", "FLOAT", "BOOLEAN", "STRING"].includes(resolvedType)) {

    // Check if the variable is referencing another variable in another layer
    // and if so, get that variable and return its name
    var alias = v as { type: string, id: string };
    if (alias.type == "VARIABLE_ALIAS") {
      return (await figma.variables.getVariableByIdAsync(alias.id))?.name;
    }

    // If the variable refers a pure value, return it as string (HEX for COLORS)
    switch (resolvedType) {
      case "COLOR":
        const { r, g, b, a = 1 } = v as RGBA;  // Default alpha (a) to 1 if not present
        return rgbToHex(r, g, b, a);
      case "BOOLEAN":
        return v as boolean;
      default:
        // This will likely happen when Figma introduces font/type variables
        return v;
    }
  }
}


// Utility method for converting rgb to a hex string
function rgbToHex(r: number, g: number, b: number, a: number) {
  if (a !== 1) {
    return `rgba(${[r, g, b]
      .map((n) => Math.round(n * 255))
      .join(", ")}, ${a.toFixed(4)})`;
  }
  const toHex = (value: number) => {
    const hex = Math.round(value * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  const hex = [toHex(r), toHex(g), toHex(b)].join("");
  return `#${hex}`;
}
// Utility method for checking if item is in collection
function isInCollection(collection: VariableCollection, selected: string[]) {
  return selected.findIndex((x) => collection.id == x) != -1;
}
