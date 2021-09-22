document.getElementById('contentFile').onchange = loadFile;

/**
 * Parse the JSON file.
 * @param {Object} event Event when loading the JSON file.
 * Inspired by https://stackoverflow.com/a/56062650
 */
function loadFile(event) {
  try {
    const files = event.target.files;
    if (!files.length) {
      alert('No file selected!');
      return;
    }
    const file = files[0];
    const reader = new FileReader();
    reader.onload = parseJournal;
    reader.readAsText(file);
  } catch (err) {
    console.error(err);
  }
};

/**
 * Parses the loaded journal JSON.
 * @param {Object} event The file reader event.
 */
function parseJournal(event) {
  const json = JSON.parse(event.target.result);
  journal = new Journal(json);
  data = createChartData(journal);
  const chart = am4core.create('chartdiv', am4charts.SankeyDiagram);

  chart.data = data;
  chart.dataFields.fromName = 'from';
  chart.dataFields.toName = 'to';
  chart.dataFields.value = 'value';
  chart.paddingRight = 300;
  chart.paddingTop = 80;
  chart.paddingBottom = 80;
  chart.nodeAlign = 'bottom';

  // Amount labels.
  // See: https://www.amcharts.com/docs/v4/reference/label/
  chart.nodes.template.nameLabel.label.propertyFields.text = "labelText";
  chart.nodes.template.nameLabel.label.propertyFields.tooltipText = "labelText";
  chart.nodes.template.nameLabel.label.truncate = false;
};

/**
 * The data structure of the journal JSON file.
 */
class Journal {
  /**
   * The representation of the journal file.
   * @param {Object} json The original JSON file.
   */
  constructor(json) {
    this.data = json;
  }

  /**
   * The beginning of the journal.
   */
  get begin() {
    return this.data.cbrDates[0][0];
  }

  /**
   * The end of the journal.
   */
  get end() {
    return this.data.cbrDates[0][1];
  }

  /**
   * Parse a subreport.
   * @param {String} name The name of the subreport.
   * @return {Object} The subreport.
   */
  parse(name) {
    for (const subreport of this.data.cbrSubreports) {
      if (subreport[0] == name) {
        const result = subreport[1];
        result.rows = result.prRows.map((element) => new Row(element));
        return result;
      }
    }
    throw new Error(`No ${name} found. ` +
                    `Did you declare ${name} in your journal?`);
  }
  /**
   * The revenues in the journal.
   */
  get revenues() {
    return this.parse('Revenues');
  }

  /**
   * The expenses in the journal.
   */
  get expenses() {
    return this.parse('Expenses');
  }
}

/**
 * The datastructure of a single subreport.
 */
class Row {
  /**
   * The representation of a single category.
   * @param {Object} json The JSON representation.
   */
  constructor(json) {
    this.uri = json.prrName;
    const elements = json.prrName.split(':');
    this.name = elements.pop();
    this.ancestors = elements;
    this.amount = json.prrAmounts[0][0].aquantity.floatingPoint;
    this.currency = json.prrAmounts[0][0].acommodity;
    this.isRoot = !this.ancestors.length;
    this.label = `${this.name} [bold]${this.amount.toFixed(0)} ${this.currency}[/]`;
  }
}

/**
 * Convert the flat list to the tree required for representation.
 * @param {Array} rows Rows of categories.
 * @return {Array} Tree representation.
 */
function parseTree(rows) {
  const tree = rows;
  const root = rows[0];
  const parents = [];
  let sibling = root.name;
  for (const row of tree.slice(1)) {
    if (row.ancestors.includes(sibling)) {
      row.source = sibling;
      parents.push(sibling);
    } else if (row.ancestors.includes(parents.at(-1))) {
      row.source = parents.at(-1);
    } else {
      parents.pop();
      row.source = parents.at(-1);
    }
    sibling = row.name;
  }
  return tree;
}

/**
 * Convert the journal data to chart data.
 * @param {Object} journal The journal data.
 * @return {Object} The chart data.
 */
function createChartData(journal) {
  const revenueTree = parseTree(journal.revenues.rows);
  const expensesTree = parseTree(journal.expenses.rows);
  const data = [];
  let totalExpenses = 0;
  for (const row of expensesTree) {
    let source = row.source;
    if (row.isRoot) {
      source = 'revenues';
      totalExpenses = row.amount;
    }
    const target = row.name;
    const value = row.amount;
    data.push({from: source,
      to: target,
      value: value,
      labelText: row.label});
  }
  for (const row of revenueTree) {
    if (!row.isRoot) {
      data.push({to: row.source,
        from: row.name,
        value: row.amount,
        labelText: row.label});
    } else {
      const savings = row.amount - totalExpenses;
      const label = `savings [bold] ${savings.toFixed(0)} ${row.currency}`;
      data.push({to: 'savings',
        from: 'revenues',
        value: savings,
        labelText: label});
    }
  }
  return data;
}
