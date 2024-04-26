

// This shows the HTML page in "ui.html".
figma.showUI(__html__);
figma.ui.resize(400, 340);


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
  const collectionsToExport: { name: string, variables: string[] }[] = [];

  const allVariableCollections = await figma.variables.getLocalVariableCollectionsAsync();

  for (const collection of allVariableCollections) {
    if (isInCollection(collection, selectedCollections)) {
      const modes = collection.modes;
      const ids = collection.variableIds;

      const variables: string[] = [];

      for (const mode of modes) {
        const modeName = mode.name;

        for (const id of ids) {
          const variable = await figma.variables.getVariableByIdAsync(id);
          if (variable != null) {
            const value = await getVariableString(variable, mode);
            variables.push(`"${variable.name}" : "${value}"`);
          }
        }
      }

      const result = { name: collection.name, variables };
      collectionsToExport.push(result);
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
