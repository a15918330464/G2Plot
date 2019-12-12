import { each, isArray, isFunction } from '@antv/util';
import { Group, BBox } from '@antv/g';
import { View } from '@antv/g2';

interface ILabel {
  position: string;
  text: string[] | Function;
  offset: number | Function;
  style: any;
}

export interface QuadrantConfig {
  xBaseline?: number;
  yBaseline?: number;
  regionStyle: any[] | any;
  label: ILabel;
}

export interface IQuadrant extends QuadrantConfig {
  view: View;
  plotOptions: any;
}

export default class Quadrant {
  public options: IQuadrant;
  protected view: View;
  protected xBaseline: number = 0;
  protected yBaseline: number = 0;
  protected quadrantGroups: Group[] = [];
  protected container: Group;
  protected regionData: any[] = [];
  protected lineData: any[] = [];

  constructor(cfg: IQuadrant) {
    this.options = cfg;
    this.view = this.options.view;
    this.init();
  }

  public init() {
    const { xBaseline, yBaseline } = this.options;
    const coord = this.view.get('coord');
    // 根据xBaseline和yBaseline分割象限
    const scales = this.view.get('scales');
    const xScale = scales[this.options.plotOptions.xField];
    const yScale = scales[this.options.plotOptions.yField];
    // 先进行x方向的分割
    let xRegion;
    if (xBaseline > xScale.min && xBaseline < xScale.max) {
      const ratio = (xBaseline - xScale.min) / (xScale.max - xScale.min);
      xRegion = [
        new BBox(coord.start.x, coord.end.y, coord.width * ratio, coord.height),
        new BBox(coord.start.x + coord.width * ratio, coord.end.y, coord.width * (1 - ratio), coord.height),
      ];
      const verticalLineData = {
        start: { x: coord.start.x + coord.width * ratio, y: coord.end.y },
        end: { x: coord.start.x + coord.width * ratio, y: coord.start.y },
      };
      this.lineData.push(verticalLineData);
    } else {
      xRegion = new BBox(coord.start.x, coord.start.y, coord.width, coord.height);
    }
    // 再进行y方向的分割
    if (yBaseline > yScale.min && yBaseline < yScale.max) {
      const ratio = (yBaseline - yScale.min) / (yScale.max - yScale.min);
      const horizontalLineData = {
        start: { x: coord.start.x, y: coord.end.y + coord.height * ratio },
        end: { x: coord.end.x, y: coord.end.y + coord.height * ratio },
      };
      this.lineData.push(horizontalLineData);
      each(xRegion, (region, index) => {
        const lastName = ['left', 'right'];
        const upper = {
          name: xRegion.length > 1 ? `top-${lastName[index]}` : 'top',
          bbox: new BBox(region.minX, region.minY, region.width, region.height * ratio),
        };
        this.regionData.push(upper);
        const lower = {
          name: xRegion.length > 1 ? `bottom-${lastName[index]}` : 'bottom',
          bbox: new BBox(region.minX, region.minY + region.height * ratio, region.width, region.height * (1 - ratio)),
        };
        this.regionData.push(lower);
      });
    } else if (xRegion.length === 2) {
      const left = {
        name: 'left',
        bbox: xRegion[0],
      };
      this.regionData.push(left);
      const right = {
        name: 'right',
        bbox: xRegion[1],
      };
      this.regionData.push(right);
    }
    // 创建container
    this.container = this.view.get('backgroundGroup').addGroup();
  }

  public render() {
    if (this.regionData.length > 0) {
      const regionStyle = this.getRegionStyle(this.regionData);
      each(this.regionData, (d, index) => {
        const group = this.container.addGroup();
        const rect = group.addShape('rect', {
          attrs: {
            x: d.bbox.minX,
            y: d.bbox.minY,
            width: d.bbox.width,
            height: d.bbox.height,
            ...regionStyle[index],
          },
          name: 'quadrant',
        });
        rect.setSilent('data', d);
        this.quadrantGroups.push(group);
      });

      //绘制象限辅助线
      each(this.lineData, (d) => {
        this.container.addShape('path', {
          attrs: {
            path: [
              ['M', d.start.x, d.start.y],
              ['L', d.end.x, d.end.y],
            ],
            stroke: 'black',
            lineWidth: 1,
          },
        });
      });
      this.view.get('canvas').draw();
    }
  }

  public clear() {}

  public destroy() {}

  protected getDefaultStyle() {
    return {
      line: {
        stroke: '#9ba29a',
        lineWidth: 1,
      },
      region_2: [
        { fill: '#000000', opacity: 0.05 },
        { fill: '#ffffff', opacity: 0 },
      ],
      region_4: [
        { fill: '#000000', opacity: 0.05 },
        { fill: '#ffffff', opacity: 0 },
        { fill: '#ffffff', opacity: 0 },
        { fill: '#000000', opacity: 0.05 },
      ],
      label: {},
    };
  }

  private getRegionStyle(regionData) {
    const regionNum = regionData.length;
    const defaultStyle = this.getDefaultStyle();
    let style;
    if (regionNum === 2) {
      style = defaultStyle.region_2;
    } else {
      style = defaultStyle.region_4;
    }
    if (this.options.regionStyle) {
      const { regionStyle } = this.options;
      if (isArray(regionStyle)) {
        style = style.map((s, index) => {
          if (regionStyle.length >= index) {
            return regionStyle[index];
          }
          return s;
        });
      } else if (isFunction(regionStyle)) {
        each(regionData, (d, index) => {
          style[index] = regionStyle(d);
        });
      }
    }

    return style;
  }
}
